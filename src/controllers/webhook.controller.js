import { Video } from "../models/video.model.js";
import asyncHandler from "../utils/asyncHandler.js";
import logger from "../utils/logger.js";

const ALLOWED_VIDEO_FORMATS = new Set(["mp4", "webm", "mov"]);
const ALLOWED_IMAGE_FORMATS = new Set(["jpg", "jpeg", "png", "webp"]);

const extractVideoId = (payload) => {
    const contextVideoId = payload?.context?.custom?.videoId;
    if (contextVideoId) return contextVideoId;

    const publicId = payload?.public_id;
    if (!publicId) return null;

    const parts = publicId.split("/");
    if (parts.length >= 4 && parts[0] === "videos")
        return parts[2];

    return null;
};

const extractFormat = (eagerResult, fallback) => {
    if (eagerResult.format) return eagerResult.format;

    const match = eagerResult.secure_url?.match(/\.([a-z0-9]+)$/i);
    return match?.[1]?.toLowerCase() || fallback;
};

const promoteToReadyIfComplete = async (videoId) => {
    await Video.findOneAndUpdate(
        {
            _id: videoId,
            status: { $ne: "ready" },
            "assets.video.url": { $exists: true },
            "assets.thumbnail.url": { $exists: true },
        },
        { $set: { status: "ready", isPublished: true } }
    );
};

export const handleCloudinaryNotification = asyncHandler(async (req, res) => {
    const payload = req.cloudinaryPayload;
    const { notification_type, public_id, resource_type, eager, format, secure_url, bytes, duration } = payload;

    res.status(200).json({ received: true });

    const videoId = extractVideoId(payload);
    if (!videoId) {
        logger.warn("Cloudinary webhook: could not resolve videoId", { public_id, notification_type });
        return;
    }

    try {
        if (notification_type === "eager") {
            if (!Array.isArray(eager) || !eager.length) {
                logger.warn("Eager notification with missing eager array", { videoId, public_id });
                return;
            }

            const transcoded = eager[0];
            const finalFormat = extractFormat(transcoded, format);

            if (!ALLOWED_VIDEO_FORMATS.has(finalFormat)) {
                await Video.findByIdAndUpdate(videoId, {
                    $set: { status: "failed", processingError: `Unsupported output format: ${finalFormat}` },
                });
                return;
            }

            await Video.findByIdAndUpdate(videoId, {
                $set: {
                    "assets.video": {
                        url: transcoded.secure_url,
                        publicId: public_id,
                        format: finalFormat,
                        bytes: transcoded.bytes,
                    },
                    ...(duration ? { duration } : {}),
                },
            });

            await promoteToReadyIfComplete(videoId);
            return;
        }

        if (notification_type === "upload") {
            if (resource_type === "video") {
                await Video.findOneAndUpdate(
                    { _id: videoId, status: "awaiting_upload" },
                    { $set: { status: "processing" } }
                );
                return;
            }

            if (resource_type === "image") {
                if (!ALLOWED_IMAGE_FORMATS.has(format)) {
                    await Video.findByIdAndUpdate(videoId, {
                        $set: { status: "failed", processingError: `Unsupported thumbnail format: ${format}` },
                    });
                    return;
                }

                await Video.findByIdAndUpdate(videoId, {
                    $set: { "assets.thumbnail": { url: secure_url, publicId: public_id, format, bytes } },
                });

                await promoteToReadyIfComplete(videoId);
                return;
            }
        }

        logger.debug({ notification_type, resource_type, videoId }, "Unhandled Cloudinary notification type — ignored");
    } catch (error) {
        logger.error({ err: error, videoId }, "Failed to process Cloudinary webhook");
    }
});