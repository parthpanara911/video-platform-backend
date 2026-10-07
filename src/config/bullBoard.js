import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { videoReconcileQueue } from "../queues/videoReconcile.queue.js";
import { assetCleanupQueue } from "../queues/assetCleanup.queue.js";

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath("/admin/queues");

createBullBoard({
    queues: [
        new BullMQAdapter(videoReconcileQueue),
        new BullMQAdapter(assetCleanupQueue),
    ],
    serverAdapter,
    options: {
        uiConfig: {
            boardTitle: "VideoStream Jobs",
        }
    }
});

export { serverAdapter };