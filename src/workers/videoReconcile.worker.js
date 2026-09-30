import "dotenv/config";
import "../config/cloudinary.js";
import { Worker } from "bullmq";
import { v2 as cloudinary } from "cloudinary";
import { redisConnection } from "../queues/connection.js";
import { Video } from "../models/video.model.js";
import connectDB from "../config/db.js";
import logger from "../utils/logger.js";

const DEFAULT_STALE_MS = process.env.NODE_ENV === "production"
    ? 30 * 60 * 1000
    : 3 * 60 * 1000;

const STALE_THRESHOLD_MS = Number(process.env.STALE_THRESHOLD_MS) || DEFAULT_STALE_MS;
const ALLOWED_VIDEO_FORMATS = new Set(["mp4", "webm", "mov"]);

const toPositiveNumber = (v) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
};

const reconcileOne = async (video) => {
    const videoPublicId = `videos/${video.owner}/${video._id}/source`;
    const thumbnailPublicId = `videos/${video.owner}/${video._id}/thumbnail`;

    let videoResource;
    try {
        videoResource = await cloudinary.api.resource(videoPublicId, { resource_type: "video", derived: true, media_metadata: true });
    } catch (err) {
        const httpCode = err?.http_code ?? err?.error?.http_code;
        if (httpCode === 404) {
            video.status = "failed";
            video.processingError = "Upload never completed";
            await video.save();
            logger.info({ videoId: video._id }, "Reconciliation: marked failed (video source never uploaded)");
            return;
        }
        logger.error({ err, videoId: video._id }, "Reconciliation: Cloudinary video lookup failed, will retry next sweep");
        return;
    }

    const resolvedDuration = toPositiveNumber(videoResource.duration);
    if (resolvedDuration) {
        video.duration = resolvedDuration;
    } else {
        logger.warn(
            { videoId: video._id, rawDuration: videoResource.duration },
            "Reconciliation: no usable duration in Cloudinary resource"
        );
    }

    if (video.status === "awaiting_upload") {
        video.status = "processing";
    }

    const transcoded = videoResource.derived?.[0];
    if (transcoded?.secure_url) {
        const finalFormat = transcoded.format
            || transcoded.secure_url.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();

        if (!ALLOWED_VIDEO_FORMATS.has(finalFormat)) {
            video.status = "failed";
            video.processingError = `Unsupported output format: ${finalFormat}`;
            await video.save();
            logger.warn({ videoId: video._id, finalFormat }, "Reconciliation: marked failed (bad transcode format)");
            return;
        }

        video.assets.video = {
            url: transcoded.secure_url,
            publicId: videoPublicId,
            format: finalFormat,
            bytes: transcoded.bytes,
        };
    }

    if (!video.assets?.thumbnail?.url) {
        try {
            const imageResource = await cloudinary.api.resource(thumbnailPublicId, { resource_type: "image" });
            if (imageResource?.secure_url) {
                video.assets.thumbnail = {
                    url: imageResource.secure_url,
                    publicId: thumbnailPublicId,
                    format: imageResource.format,
                    bytes: imageResource.bytes,
                };
            }
        } catch (err) {
            const httpCode = err?.http_code ?? err?.error?.http_code;
            if (httpCode !== 404) {
                logger.error({ err, videoId: video._id }, "Reconciliation: Cloudinary thumbnail lookup failed, will retry next sweep");
            }
        }
    }

    if (video.assets?.video?.url && video.assets?.thumbnail?.url) {
        video.status = "ready";
        video.isPublished = true;
    }

    await video.save();
    logger.info({ videoId: video._id, status: video.status }, "Reconciliation: video updated");
};

const runWorker = async () => {
    await connectDB();

    const worker = new Worker("video-reconcile", async () => {
        const cutoff = new Date(Date.now() - STALE_THRESHOLD_MS);
        logger.info({ cutoff }, "Starting video reconciliation sweep");

        const stale = await Video.find({
            status: { $in: ["awaiting_upload", "processing"] },
            createdAt: { $lt: cutoff }
        });

        logger.info({ count: stale.length }, "Stale videos found");

        for (const video of stale) {
            logger.info(
                {
                    videoId: video._id,
                    status: video.status,
                    createdAt: video.createdAt
                },
                "Reconciling video"
            );
            try {
                await reconcileOne(video);
            } catch (err) {
                logger.error({ err, videoId: video._id }, "Reconciliation: unexpected error processing video");
            }
        }

        logger.info("Reconciliation sweep complete");
    }, { connection: redisConnection });

    worker.on("completed", (job) => {
        logger.info({ jobId: job.id }, "Reconciliation job completed");
    });

    worker.on("failed", (job, err) => {
        logger.error({ jobId: job?.id, err, }, "Reconciliation job failed");
    });

    worker.on("error", (err) => {
        logger.error({ err }, "Reconciliation worker error");
    });

    logger.info("Video reconciliation worker started");
    return worker;
};

runWorker().catch((error) => {
    logger.error({ err: error }, "Failed to start video reconciliation worker");
    process.exit(1);
});