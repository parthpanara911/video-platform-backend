import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import * as playlistService from "../services/playlist.service.js";

export const createPlaylist = asyncHandler(async (req, res) => {
    const data = await playlistService.createPlaylist({
        ownerId: req.user._id,
        ...req.body
    });

    return res.status(201).json(new ApiResponse(201, data, "Playlist created successfully"));
});

export const getMyPlaylists = asyncHandler(async (req, res) => {
    const data = await playlistService.listMyPlaylists({
        ownerId: req.user._id,
        ...req.validatedQuery
    });

    return res.status(200).json(new ApiResponse(200, data, "Playlists retrieved successfully"));
});

export const getPlaylistById = asyncHandler(async (req, res) => {
    const data = await playlistService.getPlaylistById({
        playlistId: req.params.playlistId,
        viewerId: req.user?._id,
        ...req.validatedQuery,
    });

    return res.status(200).json(new ApiResponse(200, data, "Playlist retrieved successfully"));
});

export const updatePlaylist = asyncHandler(async (req, res) => {
    const data = await playlistService.updatePlaylist({
        playlistId: req.params.playlistId,
        userId: req.user._id,
        changes: req.body,
    });

    return res.status(200).json(new ApiResponse(200, data, "Playlist updated successfully"));
});

export const deletePlaylist = asyncHandler(async (req, res) => {
    const data = await playlistService.deletePlaylist({
        playlistId: req.params.playlistId,
        userId: req.user._id,
    });

    return res.status(200).json(new ApiResponse(200, data, "Playlist deleted successfully"));
});

export const addVideoToPlaylist = asyncHandler(async (req, res) => {
    const data = await playlistService.addVideo({
        userId: req.user._id,
        ...req.params
    });

    return res.status(200).json(new ApiResponse(200, data, data.added ? "Video added to playlist" : "Video already in playlist"));
});

export const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
    const data = await playlistService.removeVideo({
        userId: req.user._id,
        ...req.params
    });

    return res.status(200).json(new ApiResponse(200, data, data.removed ? "Video removed from playlist" : "Video was not in playlist"));
});