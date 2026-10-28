import { Like } from "../models/like.model.js";
import { Comment } from "../models/comment.model.js";
import { Video } from "../models/video.model.js";
import ApiError from "../utils/ApiError.js";
import { isDuplicateKeyError } from "../utils/mongoErrors.js";
import { buildPage, skipFor } from "../utils/pagination.js";
import { assertVideoVisible, getVideoCardsInOrder } from "./videoAccess.service.js";

// Creates a 404 error when the target video or comment is not found.
const notFound = (targetType) =>
    new ApiError(404, targetType === "video" ? "Video not found" : "Comment not found");

// Checks whether the target video or comment exists in the database.
const targetExists = async (targetType, targetId) =>
    targetType === "video"
        ? Boolean(await Video.exists({ _id: targetId }))
        : Boolean(await Comment.exists({ _id: targetId, isDeleted: { $ne: true } }));

// Ensures the target exists and the user is allowed to like it.
const assertTargetLikeable = async (targetType, targetId, userId) => {
    if (targetType === "video") {
        await assertVideoVisible(targetId, userId);
        return;
    }

    const comment = await Comment.findById(targetId).select("video isDeleted").lean();
    if (!comment || comment.isDeleted) throw notFound("comment");

    await assertVideoVisible(comment.video, userId, "Comment not found");
};

// Returns the total number of likes for a video or comment.
const likeCountFor = (targetType, targetId) =>
    Like.countDocuments({
        targetType,
        targetId
    });

/**
 * Likes a video or comment and returns the updated like count.
 */
export const likeTarget = async ({ userId, targetType, targetId }) => {
    await assertTargetLikeable(targetType, targetId, userId);

    const key = { user: userId, targetType, targetId };
    let created = false;

    try {
        // Create the like only if this user has not already liked the target.
        const res = await Like.updateOne(key, { $setOnInsert: key }, { upsert: true });
        created = res.upsertedCount > 0;
    } catch (err) {
        if (!isDuplicateKeyError(err)) throw err;
    }

    // Remove the newly created like if the target was deleted during the request.
    if (created && !(await targetExists(targetType, targetId))) {
        await Like.deleteOne(key);
        throw notFound(targetType);
    }

    return { targetType, targetId, liked: true, likeCount: await likeCountFor(targetType, targetId), changed: created };
};

/** 
 * Removes a user's like and returns the remaining like count.
 */
export const unlikeTarget = async ({ userId, targetType, targetId }) => {
    const res = await Like.deleteOne({ user: userId, targetType, targetId });

    if (res.deletedCount === 0 && !(await targetExists(targetType, targetId))) {
        throw notFound(targetType);
    }

    return { targetType, targetId, liked: false, likeCount: await likeCountFor(targetType, targetId), changed: res.deletedCount > 0 };
};

/**
 * Returns a paginated list of videos liked by the user.
 */
export const getLikedVideos = async ({ userId, page, limit }) => {
    const filter = { user: userId, targetType: "video" };

    const [likes, totalDocs] = await Promise.all([
        Like.find(filter)
            .sort({ createdAt: -1, _id: -1 })
            .skip(skipFor(page, limit))
            .limit(limit)
            .select("targetId createdAt")
            .lean(),

        Like.countDocuments(filter),
    ]);

    const cards = await getVideoCardsInOrder(
        likes.map((l) => l.targetId), userId
    );
    const likedAt = new Map(
        likes.map((l) => [String(l.targetId), l.createdAt])
    );
    const docs = cards.map((c) => ({
        ...c, likedAt: likedAt.get(String(c._id))
    }));

    return buildPage({ docs, totalDocs, page, limit });
};