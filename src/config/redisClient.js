import Redis from "ioredis";
import logger from "../utils/logger.js";

const redisClient = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 2,
    enableOfflineQueue: false
});

redisClient.on("connect", () => logger.info("Redis connected"));
redisClient.on("error", (err) => logger.error({ err }, "Redis connection error"));

export default redisClient;