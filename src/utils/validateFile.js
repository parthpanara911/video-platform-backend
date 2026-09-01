import { fileTypeFromFile } from "file-type";
import fs from "fs/promises";
import ApiError from "./ApiError.js";

const ALLOWED_IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_VIDEO_MIME = new Set(["video/mp4", "video/webm", "video/quicktime"]);

export const validateImageFile = async (filePath, fieldName = "Thumbnail") => {
    const detected = await fileTypeFromFile(filePath);
    if (!detected || !ALLOWED_IMAGE_MIME.has(detected.mime)) {
        await fs.unlink(filePath).catch(() => { });
        throw new ApiError(400, `Unsupported ${fieldName.toLowerCase()} format`);
    }
};

export const validateVideoFile = async (filePath, fieldName = "Video") => {
    const detected = await fileTypeFromFile(filePath);
    if (!detected || !ALLOWED_VIDEO_MIME.has(detected.mime)) {
        await fs.unlink(filePath).catch(() => { });
        throw new ApiError(400, `Unsupported ${fieldName.toLowerCase()} format`);
    }
};