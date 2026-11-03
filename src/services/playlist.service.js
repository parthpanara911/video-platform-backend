import { Playlist } from "../models/playlist.model.js";
import { User } from "../models/user.model.js";
import ApiError from "../utils/ApiError.js";
import { buildPage, skipFor } from "../utils/pagination.js";
import { sameId, toObjectId } from "../utils/objectId.js";
import { assertVideoVisible, getVideoCardsInOrder } from "./videoAccess.service.js";

export const MAX_PLAYLIST_VIDEOS = 5;
export const MAX_PLAYLISTS_PER_USER = 10;

/**
 * Finds a playlist and checks whether the user owns it.
 * Returns 404 for missing or private playlists owned by someone else.
 * Returns 403 when someone tries to modify another user's public or unlisted playlist.
 */
const findPlaylistOrThrow = async (playlistId, userId, action) => {
    const playlist = await Playlist.findById(playlistId).select("owner visibility videos").lean();

    if (!playlist) {
        throw new ApiError(404, "Playlist not found");
    }

    if (!sameId(playlist.owner, userId)) {
        if (playlist.visibility === "private") {
            throw new ApiError(404, "Playlist not found");
        }

        throw new ApiError(403, `You are not authorized to ${action} this playlist`);
    }
    return playlist;
};

/**
 * Creates a new playlist for the user.
 * Prevents users from creating more than the allowed number of playlists.
 */
export const createPlaylist = async ({ ownerId, name, description, visibility }) => {
    const playlistCount = await Playlist.countDocuments({
        owner: ownerId
    });

    if (playlistCount >= MAX_PLAYLISTS_PER_USER) {
        throw new ApiError(409, `You can have at most ${MAX_PLAYLISTS_PER_USER} playlists`);
    }

    const playlist = await Playlist.create({
        name,
        description,
        visibility,
        owner: ownerId
    });

    return {
        ...playlist.toObject(),
        videoCount: 0
    };
};

/**
 * Returns the user's playlists with pagination.
 * Can optionally filter playlists by visibility.
 */
export const listMyPlaylists = async ({ ownerId, page, limit, visibility }) => {
    const playlistFilter = {
        owner: toObjectId(ownerId),
        ...(visibility ? { visibility } : {})
    };

    const [playlists, totalPlaylists] = await Promise.all([
        Playlist.aggregate([
            { $match: playlistFilter },
            { $sort: { createdAt: -1, _id: -1 } },
            { $skip: skipFor(page, limit) },
            { $limit: limit },
            {
                $project: {
                    name: 1, description: 1, visibility: 1, createdAt: 1, updatedAt: 1,
                    videoCount: {
                        $size: { $ifNull: ["$videos", []] }
                    },
                },
            },
        ]),
        Playlist.countDocuments(playlistFilter),
    ]);

    return buildPage({
        docs: playlists,
        totalDocs: totalPlaylists,
        page,
        limit
    });
};

/**
 * Returns a playlist with its owner details and paginated videos.
 * Private playlists are visible only to their owners.
 * Deleted or inaccessible videos are skipped in the returned video list.
 */
export const getPlaylistById = async ({ playlistId, viewerId, page, limit }) => {
    const playlist = await Playlist.findById(playlistId).lean();
    if (!playlist) {
        throw new ApiError(404, "Playlist not found");
    }

    const isOwner = Boolean(viewerId) && sameId(playlist.owner, viewerId);
    if (playlist.visibility === "private" && !isOwner) {
        throw new ApiError(404, "Playlist not found");
    }

    const videoIds = playlist.videos ?? [];
    const startIndex = skipFor(page, limit);

    // Fetch the current page of videos and owner details at the same time.
    const [videoCards, owner] = await Promise.all([
        getVideoCardsInOrder(
            videoIds.slice(startIndex, startIndex + limit),
            viewerId
        ),
        User.findById(playlist.owner).select("fullName username avatar").lean(),
    ]);

    return {
        _id: playlist._id,
        name: playlist.name,
        description: playlist.description,
        visibility: playlist.visibility,
        owner,
        isOwner,
        videoCount: videoIds.length,
        createdAt: playlist.createdAt,
        updatedAt: playlist.updatedAt,
        videos: buildPage({ docs: videoCards, totalDocs: videoIds.length, page, limit })
    };
};

/**
 * Updates playlist details.
 */
export const updatePlaylist = async ({ playlistId, userId, changes }) => {
    const updated = await Playlist.findOneAndUpdate(
        { _id: playlistId, owner: userId },
        { $set: changes },
        { returnDocument: "after", runValidators: true }
    ).select("-videos").lean();

    if (!updated) {
        await findPlaylistOrThrow(playlistId, userId, "update");
        throw new ApiError(404, "Playlist not found");
    }
    return updated;
};

/**
 * Deletes a playlist.
 */
export const deletePlaylist = async ({ playlistId, userId }) => {
    const deleteResult = await Playlist.deleteOne({
        _id: playlistId,
        owner: userId
    });

    if (deleteResult.deletedCount === 0) {
        await findPlaylistOrThrow(playlistId, userId, "delete");
        throw new ApiError(404, "Playlist not found");
    }
    return { deleted: true };
};

/**
 * Adds a video to a playlist.
 * Duplicate videos and playlists exceeding the video limit are prevented.
 */
export const addVideo = async ({ playlistId, userId, videoId }) => {
    await assertVideoVisible(videoId, userId);

    const updated = await Playlist.findOneAndUpdate(
        {
            _id: playlistId,
            owner: userId,
            videos: { $ne: videoId },
            [`videos.${MAX_PLAYLIST_VIDEOS - 1}`]: { $exists: false },
        },
        { $push: { videos: videoId } },
        { returnDocument: "after" }
    ).select("videos").lean();

    if (updated) {
        return {
            playlistId,
            videoId,
            added: true,
            videoCount: updated.videos.length
        };
    }

    const playlist = await findPlaylistOrThrow(playlistId, userId, "modify");

    // Treat adding an existing video as a successful repeated request.
    if (playlist.videos.some((v) => sameId(v, videoId))) {
        return {
            playlistId,
            videoId,
            added: false,
            videoCount: playlist.videos.length
        };
    }

    if (playlist.videos.length >= MAX_PLAYLIST_VIDEOS) {
        throw new ApiError(409, `A playlist can hold at most ${MAX_PLAYLIST_VIDEOS} videos`);
    }

    throw new ApiError(409, "Playlist was modified concurrently, please retry");
};

/**
 * Removes a video from a playlist.
 * Allows removing video IDs even if the actual video has been deleted.
 */
export const removeVideo = async ({ playlistId, userId, videoId }) => {
    const before = await Playlist.findOneAndUpdate(
        { _id: playlistId, owner: userId },
        { $pull: { videos: videoId } },
        { returnDocument: "before" }
    ).select("videos").lean();

    if (!before) {
        await findPlaylistOrThrow(playlistId, userId, "modify");
        throw new ApiError(404, "Playlist not found");
    }

    // Check the old playlist to determine whether a video was actually removed.
    const removed = before.videos.some((v) => sameId(v, videoId));

    return {
        playlistId,
        videoId,
        removed,
        videoCount: before.videos.length - (removed ? 1 : 0)
    };
};