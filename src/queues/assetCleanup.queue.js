import { Queue } from "bullmq";
import { redisConnection } from "./connection.js";
import { deleteFromCloudinary } from "../utils/cloudinaryService.js";
import logger from "../utils/logger.js";

export const ASSET_CLEANUP_QUEUE = "asset-cleanup";

export const assetCleanupQueue = new Queue(ASSET_CLEANUP_QUEUE, {
    connection: redisConnection,
    defaultJobOptions: {
        attempts: 5,
        backoff: { type: "exponential", delay: 10_000 },
        removeOnComplete: { age: 60 * 60, count: 1000 },
        removeOnFail: { age: 7 * 24 * 60 * 60 },
    },
});

/**
 * Adds the asset deletion task to the queue.
 * Duplicate requests use the same job ID, so they are not added twice.
 */
export const enqueueAssetDelete = async (publicId, resourceType = "image") => {
    if (!publicId) return;

    try {
        await assetCleanupQueue.add(
            "delete-asset",
            { publicId, resourceType },
            { jobId: `del-${resourceType}-${publicId.replace(/:/g, "_")}` }
        );
    } catch (err) {
        logger.error({ err, publicId, resourceType }, "Failed to enqueue asset cleanup; attempting inline delete");
        // If the queue fails, try deleting the asset directly. If this also fails the asset is orphaned and logged.
        deleteFromCloudinary(publicId, resourceType, { invalidate: true }).catch((e) =>
            logger.error({ err: e, publicId, resourceType }, "Inline asset delete failed; asset orphaned")
        );
    }
};