import mongoose from "mongoose";
import { Video } from "../models/video.model.js";
import { User } from "../models/user.model.js";
import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { buildSignedUploadParams } from "../utils/cloudinarySignature.js";
import { deleteFromCloudinary } from "../utils/cloudinaryService.js";
import { updateVideoMetadata, issueThumbnailUpload as issueThumbnailUploadService } from "../services/video.service.js";

const MAX_CONCURRENT_UPLOADS_PER_USER = 3;

const initiateVideoUpload = asyncHandler(async (req, res) => {
    const { title, description } = req.body;

    if (!title?.trim() || !description?.trim()) {
        throw new ApiError(400, "Title and description are required");
    }

    const pendingCount = await Video.countDocuments({
        owner: req.user._id,
        status: { $in: ["awaiting_upload", "processing"] },
    });

    if (pendingCount >= MAX_CONCURRENT_UPLOADS_PER_USER) {
        throw new ApiError(429, "Too many videos are currently processing. Please wait for one to finish.");
    }

    const video = await Video.create({
        title: title.trim(),
        description: description.trim(),
        owner: req.user._id,
        status: "awaiting_upload",
    });

    const videoUpload = buildSignedUploadParams({
        resourceType: "video",
        ownerId: req.user._id.toString(),
        videoId: video._id.toString(),
        uploadPreset: process.env.CLOUDINARY_VIDEO_UPLOAD_PRESET,
        eager: "f_mp4,vc_h264,ac_aac",
    });

    const thumbnailUpload = buildSignedUploadParams({
        resourceType: "image",
        ownerId: req.user._id.toString(),
        videoId: video._id.toString(),
        uploadPreset: process.env.CLOUDINARY_IMAGE_UPLOAD_PRESET,
    });

    return res.status(200).json(
        new ApiResponse(200, {
            videoId: video._id,
            video: videoUpload,
            thumbnail: thumbnailUpload,
        }, "Upload authorized")
    );
});

const getVideoStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    if (!mongoose.isValidObjectId(videoId)) throw new ApiError(400, "Invalid video id");

    const video = await Video.findById(videoId)
        .select("status processingError title isPublished owner assets.thumbnail.url +pendingThumbnail")
        .lean();
    if (!video) throw new ApiError(404, "Video not found");

    if (video.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to view this video's status");
    }

    const { pendingThumbnail, assets, ...rest } = video;
    const payload = {
        ...rest,
        thumbnailUrl: assets?.thumbnail?.url ?? null,
        thumbnailPending: Boolean(pendingThumbnail?.publicId),
    };

    return res.status(200).json(new ApiResponse(200, payload, "Status retrieved"));
});

const getAllVideos = asyncHandler(async (req, res) => {
    const {
        page = 1,
        limit = 10,
        query,
        sortBy = "createdAt",
        sortType = "desc",
        userId
    } = req.query;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 50);

    const matchStage = {};

    if (userId) {
        if (!mongoose.isValidObjectId(userId)) throw new ApiError(400, "Invalid channel id");
        matchStage.owner = new mongoose.Types.ObjectId(userId);
    }

    const isOwnerViewing = userId && req.user && req.user._id.toString() === userId;
    if (!isOwnerViewing) {
        matchStage.status = "ready";
        matchStage.isPublished = true;
    }

    if (query?.trim()) {
        const safeQuery = query.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        matchStage.$or = [
            { title: { $regex: safeQuery, $options: "i" } },
            { description: { $regex: safeQuery, $options: "i" } },
        ];
    }

    const allowedSortFields = ["createdAt", "views", "duration", "title"];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : "createdAt";
    const sortOrder = sortType === "asc" ? 1 : -1;

    const pipeline = [
        { $match: matchStage },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",
                pipeline: [
                    {
                        $project: {
                            fullName: 1,
                            username: 1,
                            avatar: 1
                        }
                    }
                ],
            },
        },
        {
            $addFields: {
                owner: {
                    $first: "$owner"
                }
            }
        },
        {
            $project: { pendingThumbnail: 0 }
        },
        {
            $sort: {
                [sortField]: sortOrder
            }
        }
    ];

    const result = await Video.aggregatePaginate(
        Video.aggregate(pipeline),
        {
            page: pageNum,
            limit: limitNum
        }
    );

    return res.status(200)
        .json(new ApiResponse(200, result, "Videos retrieved successfully"));
});

const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    if (!mongoose.isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video id");
    }

    const matchStage = {
        _id: new mongoose.Types.ObjectId(videoId),
        $or: [
            { status: "ready", isPublished: true },
            ...(req.user ? [{ owner: req.user._id }] : [])
        ]
    };

    const [video] = await Video.aggregate([
        { $match: matchStage },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",
                pipeline: [
                    {
                        $project: {
                            fullName: 1,
                            username: 1,
                            avatar: 1
                        }
                    }
                ],
            },
        },
        {
            $addFields: {
                owner: {
                    $first: "$owner"
                }
            }
        },
        {
            $project: { pendingThumbnail: 0 }
        },
    ]);

    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    const sideEffects = [
        Video.findByIdAndUpdate(videoId, { $inc: { views: 1 } }),
    ];

    if (req.user) {
        sideEffects.push(
            User.findByIdAndUpdate(req.user._id, {
                $pull: { watchHistory: video._id }
            }).then(() =>
                User.findByIdAndUpdate(req.user._id, {
                    $push: { watchHistory: { $each: [video._id], $position: 0 } }
                })
            )
        );
    }

    await Promise.all(sideEffects);

    return res.status(200)
        .json(new ApiResponse(200, video, "Video retrieved successfully"));
});

const updateVideoDetails = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    const { title, description } = req.body;

    const video = await updateVideoMetadata({
        videoId,
        userId: req.user._id,
        title,
        description,
    });

    return res.status(200)
        .json(new ApiResponse(200, video, "Video updated successfully"));
});

const issueThumbnailUpload = asyncHandler(async (req, res) => {
    const data = await issueThumbnailUploadService({
        videoId: req.params.videoId,
        userId: req.user._id,
    });

    return res.status(200)
        .json(new ApiResponse(200, data, "Thumbnail upload authorized"));
});

const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    if (!mongoose.isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video id");
    }

    const video = await Video.findById(videoId);
    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    if (video.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to delete this video");
    }

    await Video.findByIdAndDelete(videoId);

    const cleanupTasks = [];

    if (video.assets?.video?.publicId) cleanupTasks.push(deleteFromCloudinary(video.assets.video.publicId, "video"));
    if (video.assets?.thumbnail?.publicId) cleanupTasks.push(deleteFromCloudinary(video.assets.thumbnail.publicId, "image"));

    const results = await Promise.allSettled(cleanupTasks);
    results.forEach((r) => {
        if (r.status === "rejected") console.error("Cleanup error:", r.reason);
    });

    return res.status(200)
        .json(new ApiResponse(200, {}, "Video deleted successfully"));
});

const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    if (!mongoose.isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video id");
    }

    const video = await Video.findById(videoId);
    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    if (video.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to modify this video");
    }

    if (video.status !== "ready") {
        throw new ApiError(409, "Video is still processing");
    }

    video.isPublished = !video.isPublished;
    await video.save();

    return res.status(200)
        .json(new ApiResponse(200, video, `Video ${video.isPublished ? "published" : "unpublished"} successfully`));
});

export { initiateVideoUpload, getVideoStatus, getAllVideos, getVideoById, updateVideoDetails, issueThumbnailUpload, deleteVideo, togglePublishStatus };