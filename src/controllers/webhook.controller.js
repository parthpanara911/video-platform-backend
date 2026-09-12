import { Video } from "../models/video.model.js";
import asyncHandler from "../utils/asyncHandler.js";
import logger from "../utils/logger.js";

const ALLOWED_VIDEO_FORMATS = new Set(["mp4", "webm", "mov"]);
const ALLOWED_IMAGE_FORMATS = new Set(["jpg", "jpeg", "png", "webp"]);

const parseContext = (context) => {
    return context?.custom || {};
};

export const handleCloudinaryNotification = asyncHandler(async (req, res) => {
    const payload = req.cloudinaryPayload;
    const { notification_type, public_id, resource_type, eager, format, secure_url, bytes, duration, context } = payload;

    res.status(200).json({ received: true });

    const { videoId } = parseContext(context);
    if (!videoId) {
        logger.warn("Cloudinary webhook missing videoId in context", { public_id, notification_type });
        return;
    }

    const video = await Video.findById(videoId);
    if (!video) {
        logger.warn("Cloudinary webhook for unknown video", { videoId, public_id });
        return;
    }

    try {
        if (resource_type === "video") {
            if (notification_type === "eager" && Array.isArray(eager) && eager.length) {
                const transcoded = eager[0];
                const finalFormat = transcoded.format || format;

                if (!ALLOWED_VIDEO_FORMATS.has(finalFormat)) {
                    video.status = "failed";
                    video.processingError = `Unsupported output format: ${finalFormat}`;
                    await video.save();
                    return;
                }

                video.assets.video = {
                    url: transcoded.secure_url,
                    publicId: public_id,
                    format: finalFormat,
                    bytes: transcoded.bytes,
                };
                video.duration = duration || video.duration;
            } else if (notification_type === "upload") {
                if (video.status === "awaiting_upload") video.status = "processing";
            }
        }

        if (resource_type === "image") {
            if (!ALLOWED_IMAGE_FORMATS.has(format)) {
                video.status = "failed";
                video.processingError = `Unsupported thumbnail format: ${format}`;
                await video.save();
                return;
            }
            video.assets.thumbnail = { url: secure_url, publicId: public_id, format, bytes };
        }

        if (video.assets?.video?.url && video.assets?.thumbnail?.url) {
            video.status = "ready";
            video.isPublished = true;
        }

        await video.save();
    } catch (error) {
        logger.error({ err: error, videoId }, "Failed to process Cloudinary webhook");
    }
});