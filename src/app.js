import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import httpLogger from "./utils/httpLogger.js";
import { generalApiLimiter } from "./middlewares/rateLimiter.middleware.js";
import errorHandler from "./middlewares/errorHandler.middleware.js";
import healthRouter from "./routes/health.routes.js";
import authRouter from "./routes/auth.routes.js";
import userRouter from "./routes/user.routes.js";
import channelRouter from "./routes/channel.routes.js";
import videoRouter from "./routes/video.routes.js";
import subscriptionRouter from "./routes/subscription.routes.js";
import likeRouter from "./routes/like.routes.js";
import commentRouter from "./routes/comment.routes.js";
import playlistRouter from "./routes/playlist.routes.js";
import dashboardRouter from "./routes/dashboard.routes.js";
import webhookRouter from "./routes/webhook.routes.js";
import { serverAdapter } from "./config/bullBoard.js";
import { bullBoardAuth } from "./middlewares/bullBoardAuth.middleware.js";

const app = express();

app.set("trust proxy", 1);

app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
}));

app.use("/api/v1/webhooks", webhookRouter);

app.use(express.json({ limit: "20kb" }));
app.use(express.urlencoded({ extended: true, limit: "20kb" }));
app.use(express.static("public"));
app.use(cookieParser());

app.use(httpLogger);

app.use(
    "/admin/queues",
    bullBoardAuth,
    serverAdapter.getRouter()
);

app.use(generalApiLimiter);

app.use("/api/v1/health", healthRouter);
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/users", userRouter);
app.use("/api/v1/channels", channelRouter);
app.use("/api/v1/videos", videoRouter);
app.use("/api/v1/subscriptions", subscriptionRouter);
app.use("/api/v1/likes", likeRouter);
app.use("/api/v1/comments", commentRouter);
app.use("/api/v1/playlists", playlistRouter);
app.use("/api/v1/dashboard", dashboardRouter);

app.use(errorHandler);

export default app;