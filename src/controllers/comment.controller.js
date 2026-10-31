import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import * as commentService from "../services/comment.service.js";

export const getVideoComments = asyncHandler(async (req, res) => {
    const data = await commentService.listComments({
        videoId: req.params.videoId,
        viewerId: req.user?._id,
        ...req.validatedQuery,
    });
    return res.status(200).json(new ApiResponse(200, data, "Comments retrieved successfully"));
});

export const getCommentReplies = asyncHandler(async (req, res) => {
    const data = await commentService.listReplies({
        commentId: req.params.commentId,
        viewerId: req.user?._id,
        ...req.validatedQuery,
    });
    return res.status(200).json(new ApiResponse(200, data, "Replies retrieved successfully"));
});

export const addComment = asyncHandler(async (req, res) => {
    const data = await commentService.createComment({
        videoId: req.params.videoId,
        author: req.user,
        content: req.body.content,
        parentCommentId: req.body.parentComment,
    });
    return res.status(201).json(new ApiResponse(201, data, "Comment added successfully"));
});

export const updateComment = asyncHandler(async (req, res) => {
    const data = await commentService.updateComment({
        commentId: req.params.commentId,
        userId: req.user._id,
        content: req.body.content,
    });
    return res.status(200).json(new ApiResponse(200, data, "Comment updated successfully"));
});

export const deleteComment = asyncHandler(async (req, res) => {
    const data = await commentService.deleteComment({
        commentId: req.params.commentId,
        userId: req.user._id,
    });
    return res.status(200).json(new ApiResponse(200, data, "Comment deleted successfully"));
});