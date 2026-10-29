import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import * as likeService from "../services/like.service.js";

export const likeTarget = asyncHandler(async (req, res) => {
    const data = await likeService.likeTarget({ userId: req.user._id, ...req.params });
    return res.status(200).json(new ApiResponse(200, data, data.changed ? "Liked" : "Already liked"));
});

export const unlikeTarget = asyncHandler(async (req, res) => {
    const data = await likeService.unlikeTarget({ userId: req.user._id, ...req.params });
    return res.status(200).json(new ApiResponse(200, data, data.changed ? "Like removed" : "Not liked"));
});

export const getLikedVideos = asyncHandler(async (req, res) => {
    const data = await likeService.getLikedVideos({ userId: req.user._id, ...req.validatedQuery });
    return res.status(200).json(new ApiResponse(200, data, "Liked videos retrieved successfully"));
});