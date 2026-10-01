import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { videoReconcileQueue } from "../queues/videoReconcile.queue.js";

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath("/admin/queues");

createBullBoard({
    queues: [
        new BullMQAdapter(videoReconcileQueue),
    ],
    serverAdapter,
    options: {
        uiConfig: {
            boardTitle: "VideoStream Jobs",
            pollingInterval: {
                forceInterval: 5
            }
        }
    }
});

export { serverAdapter };