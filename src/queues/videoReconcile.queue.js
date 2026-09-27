import { Queue } from "bullmq";
import { redisConnection } from "./connection.js";
import logger from "../utils/logger.js";

export const videoReconcileQueue = new Queue("video-reconcile", { connection: redisConnection });

const REPEAT_JOB_NAME = "sweep-stale-uploads";

export const scheduleReconciliation = async (everyMs = 15 * 60 * 1000) => {
    const existing = await videoReconcileQueue.getJobSchedulers();
    await Promise.all(existing.map((job) => videoReconcileQueue.removeRepeatableByKey(job.key)));

    await videoReconcileQueue.add(
        REPEAT_JOB_NAME,
        {},
        { repeat: { every: everyMs }, jobId: "video-reconcile-repeat" }
    );

    logger.info({ everyMs, clearedPrevious: existing.length }, "Video reconciliation schedule registered");
};