import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import redisClient from "../config/redisClient.js";

export const uploadInitiateLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.user._id.toString(),
    store: new RedisStore({
        sendCommand: (...args) => redisClient.call(...args)
    }),
    message: { statusCode: 429, success: false, message: "Too many upload attempts, please slow down" }
});