import Redis from "ioredis";
import logger from "../utils/logger.js";

const redisClient = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 2,
    enableOfflineQueue: false,
    lazyConnect: true,
});

redisClient.on("ready", () => logger.info("Redis connected"));
redisClient.on("error", (err) => logger.error({ err }, "Redis connection error"));

await redisClient.connect();

export default redisClient;