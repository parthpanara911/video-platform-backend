import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import * as subscriptionService from "../services/subscription.service.js";

export const subscribe = asyncHandler(async (req, res) => {
    const data = await subscriptionService.subscribe({
        subscriberId: req.user._id,
        channelId: req.params.channelId,
    });
    return res.status(200)
        .json(new ApiResponse(200, data, data.changed ? "Subscribed" : "Already subscribed"));
});

export const unsubscribe = asyncHandler(async (req, res) => {
    const data = await subscriptionService.unsubscribe({
        subscriberId: req.user._id,
        channelId: req.params.channelId,
    });
    return res.status(200)
        .json(new ApiResponse(200, data, data.changed ? "Unsubscribed" : "Not subscribed"));
});

export const getChannelSubscribers = asyncHandler(async (req, res) => {
    const data = await subscriptionService.listSubscribers({
        channelId: req.params.channelId,
        requesterId: req.user._id,
        ...req.validatedQuery,
    });
    return res.status(200).json(new ApiResponse(200, data, "Subscribers retrieved successfully"));
});

export const getSubscribedChannels = asyncHandler(async (req, res) => {
    const data = await subscriptionService.listSubscribedChannels({
        subscriberId: req.user._id,
        ...req.validatedQuery,
    });
    return res.status(200).json(new ApiResponse(200, data, "Subscribed channels retrieved successfully"));
});