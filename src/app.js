import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import httpLogger from "./utils/httpLogger.js";
import errorHandler from "./middlewares/errorHandler.middleware.js";
import healthRouter from "./routes/health.routes.js";
import authRouter from "./routes/auth.routes.js";
import userRouter from "./routes/user.routes.js";
import channelRouter from "./routes/channel.routes.js";
import videoRouter from "./routes/video.routes.js";

const app = express();

app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
}));

app.use(express.json({ limit: "20kb" }));
app.use(express.urlencoded({ extended: true, limit: "20kb" }));
app.use(express.static("public"));
app.use(cookieParser());

app.use(httpLogger);

app.use("/api/v1/health", healthRouter);
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/users", userRouter);
app.use("/api/v1/channels", channelRouter);
app.use("/api/v1/videos", videoRouter);

app.use(errorHandler);

export default app;