import { rateLimit, ipKeyGenerator } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import redisClient from "../config/redisClient.js";

const makeLimiter = ({ name, windowMs, max, keyGenerator, message }) =>
    rateLimit({
        windowMs,
        max,
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator,
        store: new RedisStore({
            prefix: `rl:${name}:`,
            sendCommand: (...args) => redisClient.call(...args),
        }),
        handler: (req, res) => {
            res.status(429).json({ statusCode: 429, success: false, message });
        },
        skip: () => redisClient.status !== "ready"
    });

// --- Auth: unauthenticated, IP-keyed ---
export const registerLimiter = makeLimiter({
    name: "register",
    windowMs: 60 * 60 * 1000,
    max: 5,
    keyGenerator: (req) => {
        const ip = req.ip ?? req.socket?.remoteAddress;
        return ip ? `ip:${ipKeyGenerator(ip)}` : "unknown";
    },
    message: "Too many registration attempts. Try again later."
});

export const loginLimiter = makeLimiter({
    name: "login",
    windowMs: 15 * 60 * 1000,
    max: 10,
    keyGenerator: (req) => {
        const ip = req.ip ?? req.socket?.remoteAddress;
        return ip ? `ip:${ipKeyGenerator(ip)}` : "unknown";
    },
    message: "Too many login attempts. Try again later."
});

export const refreshLimiter = makeLimiter({
    name: "refresh",
    windowMs: 15 * 60 * 1000,
    max: 20,
    keyGenerator: (req) => {
        const ip = req.ip ?? req.socket?.remoteAddress;
        return ip ? `ip:${ipKeyGenerator(ip)}` : "unknown";
    },
    message: "Too many token refresh attempts."
});

// --- Authenticated, user-keyed ---
export const passwordChangeLimiter = makeLimiter({
    name: "passwordChange",
    windowMs: 15 * 60 * 1000,
    max: 5,
    keyGenerator: (req) => `user:${req.user._id.toString()}`,
    message: "Too many password change attempts."
});

export const uploadInitiateLimiter = makeLimiter({
    name: "uploadInitiate",
    windowMs: 10 * 60 * 1000,
    max: 5,
    keyGenerator: (req) => `user:${req.user._id.toString()}`,
    message: "Too many upload attempts, please slow down."
});

export const thumbnailSignLimiter = makeLimiter({
    name: "thumbnailSign",
    windowMs: 10 * 60 * 1000,
    max: 5,
    keyGenerator: (req) => `user:${req.user._id.toString()}`,
    message: "Too many thumbnail upload requests, please slow down."
});

export const engagementLimiter = makeLimiter({
    name: "engagement",
    windowMs: 60 * 1000,
    max: 60,
    keyGenerator: (req) => `user:${req.user._id.toString()}`,
    message: "Too many actions, please slow down."
});

export const commentWriteLimiter = makeLimiter({
    name: "commentWrite",
    windowMs: 60 * 1000,
    max: 20,
    keyGenerator: (req) => `user:${req.user._id.toString()}`,
    message: "Too many comment actions, please slow down."
});

// --- Global fallback, applied at app level ---
export const generalApiLimiter = makeLimiter({
    name: "general",
    windowMs: 60 * 1000,
    max: 100,
    keyGenerator: (req) => {
        const userId = req.user?._id?.toString();
        if (userId) return `user:${userId}`;

        const ip = req.ip ?? req.socket?.remoteAddress;
        return ip ? `ip:${ipKeyGenerator(ip)}` : "unknown";
    },
    message: "Too many requests. Please slow down."
});