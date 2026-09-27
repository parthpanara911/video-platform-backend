import "dotenv/config";
import { videoReconcileQueue } from "../src/queues/videoReconcile.queue.js";

await videoReconcileQueue.add("manual-trigger", {});
console.log("Reconciliation job enqueued");
process.exit(0);