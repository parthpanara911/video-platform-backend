import { Video } from "../models/video.model.js";
import ApiError from "../utils/ApiError.js";
import { toObjectId } from "../utils/objectId.js";

export const videoVisibilityFilter = (viewerId) => ({
    $or: [
        { status: "ready", isPublished: true },
        ...(viewerId ? [{ owner: toObjectId(viewerId) }] : []),
    ]
});

export const assertVideoVisible = async (videoId, viewerId, notFoundMessage = "Video not found") => {
    const video = await Video.findOne({ _id: videoId, ...videoVisibilityFilter(viewerId) })
        .select("_id owner")
        .lean();
    if (!video) throw new ApiError(404, notFoundMessage);
    return video;
};

export const getVideoCardsInOrder = async (videoIds, viewerId) => {
    if (!videoIds?.length) return [];

    const cards = await Video.aggregate([
        { $match: { _id: { $in: videoIds.map(toObjectId) }, ...videoVisibilityFilter(viewerId) } },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",
                pipeline: [{ $project: { fullName: 1, username: 1, avatar: 1 } }],
            },
        },
        { $addFields: { owner: { $first: "$owner" } } },
        {
            $project: {
                title: 1,
                duration: 1,
                views: 1,
                owner: 1,
                status: 1,
                isPublished: 1,
                createdAt: 1,
                thumbnail: "$assets.thumbnail.url",
            },
        },
    ]);

    const byId = new Map(cards.map((c) => [String(c._id), c]));
    return videoIds.map((id) => byId.get(String(id))).filter(Boolean);
};