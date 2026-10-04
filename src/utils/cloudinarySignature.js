import { v2 as cloudinary } from "cloudinary";
import "../config/cloudinary.js";
import crypto from "crypto";

export const buildSignedUploadParams = ({
    resourceType,
    ownerId,
    videoId,
    uploadPreset,
    eager,
    assetName: assetNameOverride,
    overwrite
}) => {
    const timestamp = Math.floor(Date.now() / 1000);
    const assetName = assetNameOverride || (resourceType === "video" ? "source" : "thumbnail");
    const publicId = `videos/${ownerId}/${videoId}/${assetName}`;

    const notificationUrl = `${process.env.SERVER_URL}/api/v1/webhooks/cloudinary`;

    const paramsToSign = {
        timestamp,
        public_id: publicId,
        upload_preset: uploadPreset,
        asset_folder: `videos/${ownerId}/${videoId}`,
        context: `videoId=${videoId}|ownerId=${ownerId}`,
        notification_url: notificationUrl,
        ...(eager ? { eager, eager_async: true, eager_notification_url: notificationUrl } : {}),
        ...(overwrite !== undefined ? { overwrite: String(overwrite) } : {}),
    };

    const signature = cloudinary.utils.api_sign_request(
        paramsToSign,
        process.env.CLOUDINARY_API_SECRET
    );

    return {
        ...paramsToSign,
        signature,
        apiKey: process.env.CLOUDINARY_API_KEY,
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
        resourceType,
        uploadUrl: `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`,
    };
};

export const verifyCloudinaryWebhookSignature = (rawBody, timestamp, signature) => {
    const expected = crypto
        .createHash("sha1")
        .update(rawBody + timestamp + process.env.CLOUDINARY_API_SECRET)
        .digest("hex");

    const expectedBuf = Buffer.from(expected, "hex");
    const actualBuf = Buffer.from(signature || "", "hex");

    if (expectedBuf.length !== actualBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, actualBuf);
};