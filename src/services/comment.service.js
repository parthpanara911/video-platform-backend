import { Comment } from "../models/comment.model.js";
import { Like } from "../models/like.model.js";
import { User } from "../models/user.model.js";
import { Video } from "../models/video.model.js";
import ApiError from "../utils/ApiError.js";
import logger from "../utils/logger.js";
import { buildPage, skipFor } from "../utils/pagination.js";
import { sameId } from "../utils/objectId.js";
import { assertVideoVisible } from "./videoAccess.service.js";

// A deleted comment may need to remain in the database while replies refer to it.
// This placeholder satisfies the schema, but the API never shows it.
const TOMBSTONE_CONTENT = "[deleted]";

// Convert a database comment into the safe, consistent shape returned by the API.
const toPublicComment = (comment, enrichmentData) => {
    const commentId = String(comment._id);

    // Include replyCount only when the caller requested reply counts.
    const replyCountData = enrichmentData.replyCounts ? {
        replyCount: enrichmentData.replyCounts.get(commentId) ?? 0
    } : {};

    const publicComment = {
        _id: comment._id,
        video: comment.video,
        parentComment: comment.parentComment ?? null,
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt,
        ...replyCountData,
    };

    // Hide the content and owner of a deleted comment.
    // Keep the comment record if replies still depend on it.
    if (comment.isDeleted) {
        return {
            ...publicComment,
            content: null,
            owner: null,
            isDeleted: true,
            isEdited: false,
            likeCount: 0,
            isLiked: false,
        };
    }

    return {
        ...publicComment,
        content: comment.content,
        owner: enrichmentData.owners.get(String(comment.owner)) ?? null,
        isDeleted: false,
        isEdited: Boolean(comment.editedAt),
        likeCount: enrichmentData.likeCounts.get(commentId) ?? 0,
        isLiked: enrichmentData.liked.has(commentId),
    };
};

// Add owner details, like information, and optional reply counts to comments.
// Fetch related data in batches to avoid separate queries for every comment.
const enrichComments = async (comments, viewerId, { withReplyCounts }) => {
    if (!comments.length) return [];

    const commentIds = comments.map((comment) => comment._id);

    // Collect unique owners, excluding deleted comments.
    const ownerIds = [...new Set(
        comments
            .filter((comment) => !comment.isDeleted)
            .map((comment) => String(comment.owner))
    )];

    const [commentOwners, commentLikeCountResults, viewerCommentLikes, commentReplyCountResults] = await Promise.all([
        // Fetch the public details of comment owners.
        User.find({ _id: { $in: ownerIds } })
            .select("fullName username avatar")
            .lean(),

        // Count likes for each comment.
        Like.aggregate([
            {
                $match: { targetType: "comment", targetId: { $in: commentIds } }
            },
            {
                $group: { _id: "$targetId", count: { $sum: 1 } }
            },
        ]),

        // Find which comments the current viewer has liked.
        viewerId
            ? Like.find({ user: viewerId, targetType: "comment", targetId: { $in: commentIds } }).select("targetId").lean()
            : [],

        // Count replies only when the caller needs reply counts.
        withReplyCounts
            ? Comment.aggregate([
                { $match: { parentComment: { $in: commentIds } } },
                {
                    $group: { _id: "$parentComment", count: { $sum: 1 } }
                },
            ])
            : null,
    ]);

    // Store the results in maps and sets for quick lookup by comment ID.
    const enrichmentData = {
        owners: new Map(
            commentOwners.map((owner) => [String(owner._id), owner])
        ),
        likeCounts: new Map(
            commentLikeCountResults.map((result) => [String(result._id), result.count])
        ),
        liked: new Set(
            viewerCommentLikes.map((like) => String(like.targetId))
        ),
        replyCounts: commentReplyCountResults ? new Map(
            commentReplyCountResults.map((result) => [String(result._id), result.count])
        ) : null,
    };
    return comments.map((comment) => toPublicComment(comment, enrichmentData));
};

/**
 * Create a top-level comment or a reply to a top-level comment.
 */
export const createComment = async ({ videoId, author, content, parentCommentId }) => {
    await assertVideoVisible(videoId, author._id);

    // If this is a reply, validate its parent comment.
    if (parentCommentId) {
        const parentComment = await Comment.findById(parentCommentId).select("video parentComment isDeleted").lean();
        if (!parentComment || parentComment.isDeleted) {
            throw new ApiError(404, "Parent comment not found");
        }

        // A reply must belong to the same video as its parent.
        if (!sameId(parentComment.video, videoId)) {
            throw new ApiError(400, "Parent comment does not belong to this video");
        }

        if (parentComment.parentComment) {
            throw new ApiError(400, "Replies to replies are not supported; reply to the top-level comment");
        }
    }

    const comment = await Comment.create({
        content,
        video: videoId,
        owner: author._id,
        parentComment: parentCommentId ?? null,
    });

    // Check whether the video or parent was deleted during comment creation.
    // Remove the new comment if either required record is no longer valid.
    const [videoStillExists, parentStillExists] = await Promise.all([
        Video.exists({ _id: videoId }),
        parentCommentId ?
            Comment.exists({ _id: parentCommentId, isDeleted: { $ne: true } })
            : true,
    ]);

    if (!videoStillExists || !parentStillExists) {
        await Comment.deleteOne({ _id: comment._id });

        // if the parent is a deleted placeholder with no replies left, remove it
        if (parentCommentId) {
            await garbageCollectDeletedParent(parentCommentId).catch((err) =>
                logger.warn({ err, parentCommentId }, "Placeholder cleanup after rollback failed")
            );
        }

        throw new ApiError(404, !videoStillExists ? "Video not found" : "Parent comment not found");
    }

    // Reuse the author's details instead of querying for them again.
    const owners = new Map([[String(author._id), {
        _id: author._id,
        fullName: author.fullName,
        username: author.username,
        avatar: author.avatar,
    }]]);

    return toPublicComment(comment.toObject(), {
        owners,
        likeCounts: new Map(),
        liked: new Set(),
        replyCounts: parentCommentId ? null : new Map(),
    });
};

/**
 * Return a paginated list of top-level comments for a video.
 */
export const listComments = async ({ videoId, viewerId, page, limit }) => {
    await assertVideoVisible(videoId, viewerId);

    const filter = { video: videoId, parentComment: null };

    const [comments, totalComments] = await Promise.all([
        Comment.find(filter)
            .sort({ createdAt: -1, _id: -1 })
            .skip(skipFor(page, limit))
            .limit(limit)
            .lean(),

        Comment.countDocuments(filter),
    ]);

    // Add owner details, likes, and reply counts to each comment.
    const publicComments = await enrichComments(
        comments,
        viewerId,
        { withReplyCounts: true }
    );

    return buildPage({
        docs: publicComments,
        totalDocs: totalComments,
        page,
        limit
    });
};

/**
 * Return a paginated list of replies belonging to a top-level comment.
 */
export const listReplies = async ({ commentId, viewerId, page, limit }) => {
    const parentComment = await Comment.findById(commentId).select("video parentComment").lean();
    if (!parentComment || parentComment.parentComment) {
        throw new ApiError(404, "Comment not found");
    }

    await assertVideoVisible(parentComment.video, viewerId, "Comment not found");

    const filter = { parentComment: commentId };

    const [replies, totalReplies] = await Promise.all([
        Comment.find(filter)
            .sort({ createdAt: 1, _id: 1 })
            .skip(skipFor(page, limit))
            .limit(limit)
            .lean(),

        Comment.countDocuments(filter),
    ]);

    // Replies do not need their own reply counts.
    const publicReplies = await enrichComments(
        replies,
        viewerId,
        { withReplyCounts: false }
    );

    return buildPage({
        docs: publicReplies,
        totalDocs: totalReplies,
        page,
        limit
    });
};

/**
 * Update a comment's content. Only the comment owner can edit it.
 */
export const updateComment = async ({ commentId, userId, content }) => {
    const updated = await Comment.findOneAndUpdate(
        { _id: commentId, owner: userId, isDeleted: { $ne: true } },
        { $set: { content, editedAt: new Date() } },
        { returnDocument: "after", runValidators: true }
    ).lean();

    if (!updated) {
        const existingComment = await Comment.findById(commentId).select("isDeleted").lean();

        if (!existingComment || existingComment.isDeleted) {
            throw new ApiError(404, "Comment not found");
        }

        throw new ApiError(403, "You are not authorized to edit this comment");
    }

    // Return the updated comment with owner and like information.
    const [publicComment] = await enrichComments(
        [updated],
        userId,
        { withReplyCounts: !updated.parentComment }
    );

    return publicComment;
};

// Remove a deleted parent placeholder when it no longer has any replies.
const garbageCollectDeletedParent = async (parentCommentId) => {
    const hasRemainingReplies = await Comment.exists({
        parentComment: parentCommentId,
    });
    if (!hasRemainingReplies) {
        await Comment.deleteOne({ _id: parentCommentId, isDeleted: true });
    }
};

// Remove likes belonging to a deleted comment.
const removeCommentLikes = async (commentId) => {
    try {
        await Like.deleteMany({ targetType: "comment", targetId: commentId });
    } catch (err) {
        logger.error({ err, commentId }, "Failed to remove likes for deleted comment");
    }
};

/**
 * Delete a comment.
 * Replies are permanently removed. 
 * A top-level comment with replies is hidden instead of being removed, so the replies keep their parent reference.
 */
export const deleteComment = async ({ commentId, userId }) => {
    const comment = await Comment.findById(commentId).select("owner parentComment isDeleted").lean();
    if (!comment || comment.isDeleted) {
        throw new ApiError(404, "Comment not found");
    }

    if (!sameId(comment.owner, userId)) {
        throw new ApiError(403, "You are not authorized to delete this comment");
    }

    // Replies can be permanently removed because replies to replies are not allowed.
    if (comment.parentComment) {
        const deleteResult = await Comment.deleteOne({ _id: commentId, owner: userId });
        if (deleteResult.deletedCount === 0) {
            throw new ApiError(404, "Comment not found");
        }

        // Remove likes and clean up the parent if it is an unused placeholder.
        await removeCommentLikes(commentId);
        await garbageCollectDeletedParent(comment.parentComment);

        return {
            deleted: true,
            mode: "removed"
        };
    }

    // Hide the top-level comment before checking its replies.
    // This helps prevent new replies from attaching to a parent being removed.
    const deletedParent = await Comment.findOneAndUpdate(
        { _id: commentId, owner: userId, isDeleted: { $ne: true } },
        { $set: { isDeleted: true, content: TOMBSTONE_CONTENT } },
        { returnDocument: "after" }
    ).select("_id").lean();

    if (!deletedParent) {
        throw new ApiError(404, "Comment not found");
    }

    // Keep the hidden parent only if replies still depend on it.
    const hasReplies = Boolean(
        await Comment.exists({ parentComment: commentId })
    );
    if (!hasReplies) {
        await Comment.deleteOne({ _id: commentId, isDeleted: true });
    }

    // Remove likes from the deleted comment.
    await removeCommentLikes(commentId);

    return {
        deleted: true,
        mode: hasReplies ? "tombstoned" : "removed"
    };
};