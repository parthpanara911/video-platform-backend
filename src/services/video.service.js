import crypto from "crypto";
import { Video } from "../models/video.model.js";
import ApiError from "../utils/ApiError.js";
import logger from "../utils/logger.js";
import { buildSignedUploadParams } from "../utils/cloudinarySignature.js";
import { enqueueAssetDelete } from "../queues/assetCleanup.queue.js";

export const ALLOWED_IMAGE_FORMATS = new Set(["jpg", "jpeg", "png", "webp"]);
export const MAX_THUMBNAIL_BYTES = 5 * 1024 * 1024;

const explainMiss = async (videoId, userId, action) => {
    const video = await Video.findById(videoId).select("owner status").lean();
    if (!video) throw new ApiError(404, "Video not found");

    if (video.owner.toString() !== userId.toString()) {
        throw new ApiError(403, `You are not authorized to ${action} this video`);
    }
    return video;
};

// ---------------------------------------------------------------------------
// PATCH /videos/:videoId  
// ---------------------------------------------------------------------------
export const updateVideoMetadata = async ({ videoId, userId, title, description }) => {
    const $set = {};
    if (title !== undefined) $set.title = title;
    if (description !== undefined) $set.description = description;

    // Single atomic, owner-scoped write: update the video only if the user owns it.
    const updated = await Video.findOneAndUpdate(
        { _id: videoId, owner: userId },
        { $set },
        { returnDocument: "after", runValidators: true }
    );

    if (!updated) {
        await explainMiss(videoId, userId, "update");
        throw new ApiError(404, "Video not found"); // Video was deleted before the update finished
    }
    return updated;
};

// ---------------------------------------------------------------------------
// POST /videos/:videoId/thumbnail/upload-url
// ---------------------------------------------------------------------------
export const issueThumbnailUpload = async ({ videoId, userId }) => {
    const nonce = crypto.randomBytes(8).toString("hex");
    const assetName = `thumbnail-${nonce}`;
    const publicId = `videos/${userId}/${videoId}/${assetName}`;

    // Overwrites the previous pending entry => save the latest upload request.
    const updated = await Video.findOneAndUpdate(
        { _id: videoId, owner: userId, status: "ready" },
        {
            $set: {
                pendingThumbnail: {
                    publicId,
                    issuedAt: new Date()
                }
            }
        },
        { returnDocument: "after" }
    ).select("_id");

    if (!updated) {
        await explainMiss(videoId, userId, "modify");
        throw new ApiError(409, "Video is still processing");
    }

    const upload = buildSignedUploadParams({
        resourceType: "image",
        ownerId: userId.toString(),
        videoId: videoId.toString(),
        uploadPreset: process.env.CLOUDINARY_IMAGE_UPLOAD_PRESET,
        assetName,
        overwrite: false,
    });

    return { videoId, thumbnail: upload, maxBytes: MAX_THUMBNAIL_BYTES };
};

// ---------------------------------------------------------------------------
// Handles notifications when a thumbnail is uploaded.
//
// Returns:
//   "initial"    -> video is not ready yet, so use the normal upload flow
//   "swapped"    -> new thumbnail was checked and replaced the old one
//   "rejected"   -> replacement invalid; asset deleted, live thumbnail untouched
//   "duplicate"  -> redelivery of the already-live thumbnail; no-op
//   "stale"      -> not the latest issued upload; asset deleted
//   "superseded" -> another upload was completed first, so this upload is no longer needed
//   "orphaned"   -> video no longer exists, so the thumbnail was deleted
// ---------------------------------------------------------------------------
export const processThumbnailNotification = async ({ videoId, publicId, secureUrl, format, bytes }) => {
    const video = await Video.findById(videoId)
        .select("status assets.thumbnail.publicId +pendingThumbnail")
        .lean();

    if (!video) {
        await enqueueAssetDelete(publicId, "image");
        return "orphaned";
    }

    if (video.status !== "ready") return "initial";

    if (video.assets?.thumbnail?.publicId === publicId) return "duplicate";

    if (video.pendingThumbnail?.publicId !== publicId) {
        await enqueueAssetDelete(publicId, "image");
        return "stale";
    }

    // Validate the new thumbnail before replacing the current one. 
    const validFormat = ALLOWED_IMAGE_FORMATS.has(format);
    const validSize = Number.isFinite(bytes) && bytes > 0 && bytes <= MAX_THUMBNAIL_BYTES;

    if (!validFormat || !validSize) {
        logger.warn({ videoId, publicId, format, bytes }, "Replacement thumbnail rejected");
        await enqueueAssetDelete(publicId, "image");
        await Video.updateOne(
            { _id: videoId, "pendingThumbnail.publicId": publicId },
            { $unset: { pendingThumbnail: 1 } }
        );
        return "rejected";
    }

    // Atomic compare-and-swap; returns the document as it was BEFORE the swap.
    const previous = await Video.findOneAndUpdate(
        { _id: videoId, status: "ready", "pendingThumbnail.publicId": publicId },
        {
            $set: {
                "assets.thumbnail": { url: secureUrl, publicId, format, bytes }
            },
            $unset: { pendingThumbnail: 1 },
        },
        { returnDocument: "before" }
    )
        .select("assets.thumbnail.publicId")
        .lean();

    if (!previous) {
        // Another request updated the thumbnail, so delete this asset if it is not the current one.
        const current = await Video.findById(videoId)
            .select("assets.thumbnail.publicId")
            .lean();
        if (current?.assets?.thumbnail?.publicId !== publicId) {
            await enqueueAssetDelete(publicId, "image");
        }
        return "superseded";
    }

    const oldPublicId = previous.assets?.thumbnail?.publicId;
    if (oldPublicId && oldPublicId !== publicId) {
        await enqueueAssetDelete(oldPublicId, "image");
    }

    logger.info({ videoId, publicId, oldPublicId }, "Thumbnail replaced");
    return "swapped";
};