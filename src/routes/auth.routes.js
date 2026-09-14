import { Router } from "express";
import { registerUser, loginUser, logoutUser, refreshAccessToken } from "../controllers/auth.controller.js";
import { uploadUserImages } from "../middlewares/multer.middleware.js";
import { handleMulterUpload } from "../middlewares/handleMulterError.middleware.js";
import cleanupUploadedFiles from "../middlewares/cleanupUploadedFiles.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { registerLimiter, loginLimiter, refreshLimiter } from "../middlewares/rateLimiter.middleware.js";

const router = Router();

router.route("/register").post(
    registerLimiter,
    handleMulterUpload(
        uploadUserImages.fields([
            { name: "avatar", maxCount: 1 },
            { name: "coverImage", maxCount: 1 }
        ]),
        {
            avatar: { label: "Avatar", maxSizeMB: 5 },
            coverImage: { label: "Cover image", maxSizeMB: 5 }
        }
    ),
    cleanupUploadedFiles,
    registerUser
);

router.route("/login").post(loginLimiter, loginUser);
router.route("/logout").post(verifyJWT, logoutUser);
router.route("/refresh").post(refreshLimiter, refreshAccessToken);

export default router;