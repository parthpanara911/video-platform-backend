import { Queue } from "bullmq";
import { redisConnection } from "./connection.js";
import logger from "../utils/logger.js";

export const videoReconcileQueue = new Queue("video-reconcile", {
    connection: redisConnection,
    defaultJobOptions: {
        removeOnComplete: { age: 60 * 60, count: 100 },
        removeOnFail: { age: 7 * 24 * 60 * 60 },
    },
});

const SCHEDULER_ID = "video-reconcile-schedule";

export const scheduleReconciliation = async (everyMs = 15 * 60 * 1000) => {
    const existing = await videoReconcileQueue.getJobSchedulers();
    const stale = existing.filter((s) => s.key !== SCHEDULER_ID);
    await Promise.all(stale.map((s) => videoReconcileQueue.removeJobScheduler(s.key)));

    await videoReconcileQueue.upsertJobScheduler(
        SCHEDULER_ID,
        { every: everyMs },
        { name: "sweep-stale-uploads", data: {} }
    );

    /**
     * Runs a startup reconciliation sweep without waiting for the next interval.
     * Duplicate startup jobs use the same job ID within an interval.
     */
    const bucket = Math.floor(Date.now() / everyMs);

    await videoReconcileQueue.add(
        "startup-sweep",
        {},
        { jobId: `startup-sweep-${bucket}` }
    );

    logger.info({ everyMs, removedStale: stale.length }, "Video reconciliation schedule registered");
};