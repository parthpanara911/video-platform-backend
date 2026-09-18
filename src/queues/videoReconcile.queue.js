import { Queue } from "bullmq";
import { redisConnection } from "./connection.js";

export const videoReconcileQueue = new Queue("video-reconcile", { connection: redisConnection });

export const scheduleReconciliation = async () => {
    await videoReconcileQueue.add(
        "sweep-stale-uploads",
        {},
        { repeat: { every: 15 * 60 * 1000 }, jobId: "video-reconcile-repeat" }
    );
};