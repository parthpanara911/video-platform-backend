import { Video } from "../models/video.model.js";
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

export { publishVideo };