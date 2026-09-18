import { Worker } from "bullmq";
import { v2 as cloudinary } from "cloudinary";
import { redisConnection } from "../queues/connection.js";
import { Video } from "../models/video.model.js";
import logger from "../utils/logger.js";

const STALE_THRESHOLD_MS = 30 * 60 * 1000;

new Worker("video-reconcile", async () => {
    const cutoff = new Date(Date.now() - STALE_THRESHOLD_MS);
    const stale = await Video.find({
        status: { $in: ["awaiting_upload", "processing"] },
        createdAt: { $lt: cutoff }
    });

    for (const video of stale) {
        const publicId = `videos/${video.owner}/${video._id}/source`;
        try {
            const resource = await cloudinary.api.resource(publicId, { resource_type: "video" });
            if (resource.secure_url) {
                video.assets.video = { url: resource.secure_url, publicId, format: resource.format, bytes: resource.bytes };
                if (video.assets?.thumbnail?.url) {
                    video.status = "ready";
                    video.isPublished = true;
                } else {
                    video.status = "processing";
                }
            }
        } catch (err) {
            if (err?.http_code === 404) {
                video.status = "failed";
                video.processingError = "Upload never completed";
            } else {
                logger.error({ err, videoId: video._id }, "Reconciliation check failed, will retry next sweep");
                continue;
            }
        }
        await video.save();
    }
}, { connection: redisConnection });