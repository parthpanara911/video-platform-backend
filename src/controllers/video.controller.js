import mongoose from "mongoose";
import { Video } from "../models/video.model.js";
import { User } from "../models/user.model.js";
import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { uploadOnCloudinary, deleteFromCloudinary } from "../utils/cloudinary.js";

const ALLOWED_VIDEO_MIME = ["video/mp4", "video/webm", "video/quicktime"];
const ALLOWED_IMAGE_MIME = ["image/jpeg", "image/png", "image/webp"];
const MAX_VIDEO_SIZE = 200 * 1024 * 1024;
const MAX_THUMBNAIL_SIZE = 5 * 1024 * 1024;

const publishVideo = asyncHandler(async (req, res) => {
    const { title, description } = req.body;

    if (!title?.trim() || !description?.trim()) {
        throw new ApiError(400, "Title and description are required");
    }

    const videoFile = req.files?.videoFile?.[0];
    const thumbnailFile = req.files?.thumbnail?.[0];

    if (!videoFile) throw new ApiError(400, "Video file is required");
    if (!thumbnailFile) throw new ApiError(400, "Thumbnail image is required");

    if (!ALLOWED_VIDEO_MIME.includes(videoFile.mimetype)) {
        throw new ApiError(400, "Unsupported video format");
    }
    if (videoFile.size > MAX_VIDEO_SIZE) {
        throw new ApiError(400, "Video file exceeds the 200MB limit");
    }
    if (!ALLOWED_IMAGE_MIME.includes(thumbnailFile.mimetype)) {
        throw new ApiError(400, "Unsupported thumbnail format");
    }
    if (thumbnailFile.size > MAX_THUMBNAIL_SIZE) {
        throw new ApiError(400, "Thumbnail exceeds the 5MB limit");
    }

    const uploadedVideo = await uploadOnCloudinary(videoFile.path);
    if (!uploadedVideo?.secure_url || !uploadedVideo?.public_id) {
        throw new ApiError(500, "Failed to upload the video file");
    }

    const uploadedThumbnail = await uploadOnCloudinary(thumbnailFile.path);
    if (!uploadedThumbnail?.secure_url || !uploadedThumbnail?.public_id) {
        await deleteFromCloudinary(uploadedVideo.public_id, "video").catch(() => { });
        throw new ApiError(500, "Failed to upload the thumbnail image");
    }

    try {
        const video = await Video.create({
            title: title.trim(),
            description: description.trim(),
            assets: {
                video: {
                    url: uploadedVideo.secure_url,
                    publicId: uploadedVideo.public_id
                },
                thumbnail: {
                    url: uploadedThumbnail.secure_url,
                    publicId: uploadedThumbnail.public_id
                }
            },
            duration: uploadedVideo.duration || 0,
            owner: req.user._id,
        });

        return res.status(201)
            .json(new ApiResponse(201, video, "Video published successfully"));
    } catch (error) {
        await Promise.allSettled([
            deleteFromCloudinary(uploadedVideo.public_id, "video"),
            deleteFromCloudinary(uploadedThumbnail.public_id, "image")
        ]);
        throw new ApiError(500, "Failed to publish video. Please try again.");
    }
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
        if (!mongoose.isValidObjectId(userId)) {
            throw new ApiError(400, "Invalid channel id");
        }
        matchStage.owner = new mongoose.Types.ObjectId(userId);
    }

    const isOwnerViewing = userId && req.user && req.user._id.toString() === userId;
    if (!isOwnerViewing) {
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

    const [video] = await Video.aggregate([
        { $match: { _id: new mongoose.Types.ObjectId(videoId) } },
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
    ]);

    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    const isOwner = req.user && video.owner?._id?.toString() === req.user._id.toString();

    if (!video.isPublished && !isOwner) {
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

export { publishVideo, getAllVideos, getVideoById };