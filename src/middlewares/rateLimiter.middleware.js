import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import redisClient from "../config/redisClient.js";

const makeLimiter = ({ windowMs, max, keyGenerator, message }) =>
    rateLimit({
        windowMs,
        max,
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator,
        store: new RedisStore({
            sendCommand: (...args) => redisClient.call(...args),
        }),
        handler: (req, res) => {
            res.status(429).json({ statusCode: 429, success: false, message });
        },
        skip: () => redisClient.status !== "ready"
    });

// --- Auth: unauthenticated, IP-keyed ---
export const registerLimiter = makeLimiter({
    windowMs: 60 * 60 * 1000,
    max: 5,
    keyGenerator: (req) => req.ip,
    message: "Too many registration attempts. Try again later."
});

export const loginLimiter = makeLimiter({
    windowMs: 15 * 60 * 1000,
    max: 10,
    keyGenerator: (req) => req.ip,
    message: "Too many login attempts. Try again later."
});

export const refreshLimiter = makeLimiter({
    windowMs: 15 * 60 * 1000,
    max: 20,
    keyGenerator: (req) => req.ip,
    message: "Too many token refresh attempts."
});

// --- Authenticated, user-keyed ---
export const passwordChangeLimiter = makeLimiter({
    windowMs: 15 * 60 * 1000,
    max: 5,
    keyGenerator: (req) => req.user._id.toString(),
    message: "Too many password change attempts."
});

export const uploadInitiateLimiter = makeLimiter({
    windowMs: 10 * 60 * 1000,
    max: 5,
    keyGenerator: (req) => req.user._id.toString(),
    message: "Too many upload attempts, please slow down."
});

// --- Global fallback, applied at app level ---
export const generalApiLimiter = makeLimiter({
    windowMs: 60 * 1000,
    max: 100,
    keyGenerator: (req) => req.user?._id?.toString() || req.ip,
    message: "Too many requests. Please slow down."
});