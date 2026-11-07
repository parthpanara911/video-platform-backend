import { Video } from "../models/video.model.js";
import { Like } from "../models/like.model.js";
import { Subscription } from "../models/subscription.model.js";
import { buildPage, skipFor } from "../utils/pagination.js";
import { toObjectId } from "../utils/objectId.js";

// Defines which videos belong to each dashboard state.
export const STATE_FILTERS = {
    published: { status: "ready", isPublished: true },
    unpublished: { status: "ready", isPublished: { $ne: true } },
    processing: { status: { $in: ["awaiting_upload", "processing"] } },
    failed: { status: "failed" },
};

// Counts videos that match the given condition.
const countIf = (cond) => ({
    $sum: {
        $cond: [cond, 1, 0]
    }
});

/**
 * Calculates the creator's total videos, views, likes, and subscribers.
 */
export const getChannelStats = async (creatorId) => {
    const owner = toObjectId(creatorId);

    const [[stats], totalSubscribers] = await Promise.all([
        Video.aggregate([
            { $match: { owner } },
            {
                $lookup: {
                    from: "likes",
                    localField: "_id",
                    foreignField: "targetId",
                    pipeline: [
                        { $match: { targetType: "video" } },
                        { $count: "n" }
                    ],
                    as: "likeAgg"
                },
            },
            {
                $group: {
                    _id: null,
                    totalVideos: { $sum: 1 },
                    totalViews: { $sum: "$views" },
                    totalLikes: {
                        $sum: {
                            $ifNull: [
                                { $first: "$likeAgg.n" },
                                0
                            ]
                        }
                    },
                    publishedVideos: countIf({
                        $and: [
                            { $eq: ["$status", "ready"] },
                            { $eq: ["$isPublished", true] }
                        ]
                    }),
                    unpublishedVideos: countIf({
                        $and: [
                            { $eq: ["$status", "ready"] },
                            { $ne: ["$isPublished", true] }
                        ]
                    }),
                    processingVideos: countIf({
                        $in: [
                            "$status",
                            ["awaiting_upload", "processing"]
                        ]
                    }),
                    failedVideos: countIf({
                        $eq: ["$status", "failed"]
                    }),
                },
            },
            { $project: { _id: 0 } },
        ]),

        Subscription.countDocuments({ channel: owner }),
    ]);

    return {
        totalVideos: 0,
        publishedVideos: 0,
        unpublishedVideos: 0,
        processingVideos: 0,
        failedVideos: 0,
        totalViews: 0,
        totalLikes: 0,
        ...(stats ?? {}),
        totalSubscribers,
    };
};

/**
 * Returns the creator's videos with filtering, sorting, and pagination.
 */
export const listCreatorVideos = async ({ creatorId, page, limit, state, sortBy, sortType }) => {
    const owner = toObjectId(creatorId);
    const videoFilter = {
        owner,
        ...(state ? STATE_FILTERS[state] : {})
    };

    const sortDirection = sortType === "asc" ? 1 : -1;
    const sortOptions = sortBy === "createdAt"
        ? { createdAt: sortDirection, _id: sortDirection }
        : { [sortBy]: sortDirection, _id: -1 };

    let videosQuery = Video.find(videoFilter)
        .sort(sortOptions)
        .skip(skipFor(page, limit))
        .limit(limit)
        .select("title status processingError isPublished views duration assets.thumbnail.url createdAt updatedAt")
        .lean();

    if (sortBy === "title") {
        videosQuery = videosQuery.collation({ locale: "en", strength: 2, numericOrdering: true });
    }

    const [videos, totalVideos] = await Promise.all([
        videosQuery,
        Video.countDocuments(videoFilter),
    ]);

    // Get like counts for all videos on the current page in one query.
    const likeCounts = videos.length
        ? await Like.aggregate([
            {
                $match: {
                    targetType: "video",
                    targetId: { $in: videos.map((video) => video._id) }
                }
            },
            {
                $group: {
                    _id: "$targetId",
                    count: { $sum: 1 }
                }
            }
        ])
        : [];

    const likes = new Map(
        likeCounts.map((likeResult) => [String(likeResult._id), likeResult.count])
    );

    const videoCards = videos.map(({ assets, ...video }) => ({
        ...video,
        thumbnail: assets?.thumbnail?.url ?? null,
        likeCount: likes.get(String(video._id)) ?? 0,
    }));

    return buildPage({
        docs: videoCards,
        totalDocs: totalVideos,
        page,
        limit
    });
};