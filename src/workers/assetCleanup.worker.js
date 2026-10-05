import "dotenv/config";
import "../config/cloudinary.js";
import { Worker } from "bullmq";
import { redisConnection } from "../queues/connection.js";
import { ASSET_CLEANUP_QUEUE } from "../queues/assetCleanup.queue.js";
import { deleteFromCloudinary } from "../utils/cloudinaryService.js";
import logger from "../utils/logger.js";

const runWorker = async () => {
    const worker = new Worker(
        ASSET_CLEANUP_QUEUE,
        async (job) => {
            const { publicId, resourceType = "image" } = job.data;

            const res = await deleteFromCloudinary(publicId, resourceType, { invalidate: true });

            // If the asset is already deleted, treat it as successful (idempotent).
            if (res?.result !== "ok" && res?.result !== "not found") {
                throw new Error(`Unexpected Cloudinary destroy result: ${res?.result}`);
            }

            logger.info({ publicId, resourceType, result: res.result }, "Asset cleanup done");
        },
        { connection: redisConnection, concurrency: 5 }
    );

    worker.on("failed", (job, err) => {
        const exhausted = job && job.attemptsMade >= (job.opts?.attempts ?? 1);
        logger.error(
            { jobId: job?.id, publicId: job?.data?.publicId, attemptsMade: job?.attemptsMade, exhausted, err },
            exhausted ? "Asset cleanup permanently failed; asset orphaned" : "Asset cleanup attempt failed"
        );
    });

    worker.on("error", (err) => logger.error({ err }, "Asset cleanup worker error"));

    const shutdown = async (signal) => {
        logger.info({ signal }, "Shutting down asset cleanup worker");
        await worker.close();
        process.exit(0);
    };
    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));

    logger.info("Asset cleanup worker started");
};

runWorker().catch((error) => {
    logger.error({ err: error }, "Failed to start asset cleanup worker");
    process.exit(1);
});