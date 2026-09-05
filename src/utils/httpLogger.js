import pinoHttp from "pino-http";
import { randomUUID } from "crypto";
import logger from "./logger.js";

const httpLogger = pinoHttp({
    logger,
    genReqId: (req, res) => {
        const existingId = req.headers["x-request-id"];
        const id = existingId || randomUUID();
        res.setHeader("x-request-id", id);
        return id;
    },
    customLogLevel: (req, res, err) => {
        if (res.statusCode >= 500 || err) return "error";
        if (res.statusCode >= 400) return "warn";
        return "info";
    },
    serializers: {
        req: (req) => ({
            method: req.method,
            url: req.url,
            id: req.id,
        }),
        res: (res) => ({
            statusCode: res.statusCode,
        }),
    },
    autoLogging: {
        ignore: (req) => req.url === "/api/v1/health",
    },
});

export default httpLogger;