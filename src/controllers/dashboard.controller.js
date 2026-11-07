import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import * as dashboardService from "../services/dashboard.service.js";

export const getChannelStats = asyncHandler(async (req, res) => {
    const data = await dashboardService.getChannelStats(req.user._id);

    return res.status(200).json(new ApiResponse(200, data, "Channel stats retrieved successfully"));
});

export const getChannelVideos = asyncHandler(async (req, res) => {
    const data = await dashboardService.listCreatorVideos({
        creatorId: req.user._id,
        ...req.validatedQuery
    });

    return res.status(200).json(new ApiResponse(200, data, "Channel videos retrieved successfully"));
});