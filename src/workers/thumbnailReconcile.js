import "../config/cloudinary.js";
import { v2 as cloudinary } from "cloudinary";
import { Video } from "../models/video.model.js";
import { processThumbnailNotification } from "../services/video.service.js";
import logger from "../utils/logger.js";

const toPositiveInt = (v, fallback) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
};

// Give the webhook some time to arrive before reconciling.
const MIN_AGE_MS = toPositiveInt(process.env.THUMBNAIL_RECONCILE_MIN_AGE_MS, 10 * 60 * 1000);

// Give the upload enough time to complete before clearing the pending record.
const EXPIRY_MS = toPositiveInt(process.env.THUMBNAIL_PENDING_EXPIRY_MS, 70 * 60 * 1000);
const BATCH = toPositiveInt(process.env.THUMBNAIL_RECONCILE_BATCH, 10);

export const sweepPendingThumbnails = async () => {
    const now = Date.now();

    const candidates = await Video.find({
        status: "ready",
        "pendingThumbnail.issuedAt": { $lt: new Date(now - MIN_AGE_MS) },
    })
        .select("+pendingThumbnail")
        .sort({ "pendingThumbnail.issuedAt": 1 })
        .limit(BATCH)
        .lean();

    if (!candidates.length) return;
    logger.info({ count: candidates.length }, "Pending thumbnail sweep: candidates found");

    for (const video of candidates) {
        const { publicId, issuedAt } = video.pendingThumbnail;

        try {
            const resource = await cloudinary.api.resource(publicId, { resource_type: "image" });

            const outcome = await processThumbnailNotification({
                videoId: video._id.toString(),
                publicId,
                secureUrl: resource.secure_url,
                format: resource.format,
                bytes: resource.bytes,
            });
            logger.info({ videoId: video._id, publicId, outcome }, "Pending thumbnail reconciled");
        } catch (err) {
            const httpCode = err?.http_code ?? err?.error?.http_code;

            if (httpCode === 404) {
                if (now - new Date(issuedAt).getTime() > EXPIRY_MS) {
                    await Video.updateOne(
                        { _id: video._id, "pendingThumbnail.publicId": publicId },
                        { $unset: { pendingThumbnail: 1 } }
                    );
                    logger.info({ videoId: video._id, publicId }, "Pending thumbnail expired and cleared");
                }
                // The upload may still be processing, so check again in the next sweep.
                continue;
            }

            logger.error({ err, videoId: video._id, publicId }, "Pending thumbnail sweep failed; will retry next sweep");
        }
    }
};