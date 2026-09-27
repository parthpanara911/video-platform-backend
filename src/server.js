import "dotenv/config";
import app from "./app.js";
import connectDB from "./config/db.js";
import { scheduleReconciliation } from "./queues/videoReconcile.queue.js";
import logger from "./utils/logger.js";

const PORT = process.env.PORT || 4001;

const startServer = async () => {
    try {
        await connectDB();
        await scheduleReconciliation(Number(process.env.RECONCILE_INTERVAL_MS) || 15 * 60 * 1000);

        app.listen(PORT, () => {
            logger.info(`Server running on port ${PORT}`);
        });
    } catch (error) {
        logger.error({ err: error }, "Server startup failed");
        process.exit(1);
    }
};

startServer();