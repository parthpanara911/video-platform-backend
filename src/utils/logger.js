import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";

const redactPaths = [
    "req.headers.authorization",
    "req.headers.cookie",
    "req.body.password",
    "req.body.oldPassword",
    "req.body.newPassword",
    "res.headers['set-cookie']",
    "*.password",
    "*.refreshToken",
    "*.accessToken",
];

const logger = pino({
    level: process.env.LOG_LEVEL || (isProduction ? "info" : "debug"),
    redact: {
        paths: redactPaths,
        censor: "[REDACTED]",
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    transport: isProduction
        ? undefined
        : {
            target: "pino-pretty",
            options: {
                colorize: true,
                translateTime: "SYS:standard",
                ignore: "pid,hostname",
            },
        },
});

export default logger;