import multer from "multer";
import ApiError from "../utils/ApiError.js";

const buildSizeMessage = (field, fieldConfig) => {
    const cfg = fieldConfig[field];
    if (cfg) return `${cfg.label} exceeds the ${cfg.maxSizeMB}MB limit`;
    return "Uploaded file exceeds the allowed size limit";
};

const buildUnexpectedFieldMessage = (field, fieldConfig) => {
    const cfg = fieldConfig[field];
    if (cfg) return `Unexpected file field: ${field}`;
    return "Unexpected file field";
};

export const handleMulterUpload = (multerMiddleware, fieldConfig = {}) => (req, res, next) => {
    multerMiddleware(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            if (err.code === "LIMIT_FILE_SIZE") {
                return next(new ApiError(400, buildSizeMessage(err.field, fieldConfig)));
            }
            if (err.code === "LIMIT_UNEXPECTED_FILE") {
                return next(new ApiError(400, buildUnexpectedFieldMessage(err.field, fieldConfig)));
            }
            return next(new ApiError(400, err.message));
        }
        if (err) return next(err);
        next();
    });
};