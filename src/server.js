import "dotenv/config";
import app from "./app.js";
import connectDB from "./config/db.js";
import { scheduleReconciliation } from "./queues/videoReconcile.queue.js";

const PORT = process.env.PORT || 4001;

const startServer = async () => {
    try {
        await connectDB();
        await scheduleReconciliation();

        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    } catch (error) {
        console.error("Server startup failed:", error);
    }
};

startServer();