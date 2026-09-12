import ApiError from "../utils/ApiError.js";
import { verifyCloudinaryWebhookSignature } from "../utils/cloudinarySignature.js";

const MAX_WEBHOOK_AGE_SECONDS = 5 * 60;

export const verifyCloudinaryWebhook = (req, res, next) => {
    const signature = req.header("X-Cld-Signature");
    const timestamp = req.header("X-Cld-Timestamp");

    if (!signature || !timestamp) {
        throw new ApiError(401, "Missing webhook signature headers");
    }

    const age = Math.floor(Date.now() / 1000) - Number(timestamp);
    if (!Number.isFinite(age) || age > MAX_WEBHOOK_AGE_SECONDS || age < -30) {
        throw new ApiError(401, "Webhook timestamp outside acceptable window");
    }

    const rawBody = req.body.toString("utf8");
    const isValid = verifyCloudinaryWebhookSignature(rawBody, timestamp, signature);

    if (!isValid) {
        throw new ApiError(401, "Invalid webhook signature");
    }

    req.cloudinaryPayload = JSON.parse(rawBody);
    next();
};