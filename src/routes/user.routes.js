import { Router } from "express";
import { getCurrentUser, updateAccountDetails, changeCurrentPassword, updateAvatar, updateCoverImage, getWatchHistory } from "../controllers/user.controller.js";
import { uploadUserImages } from "../middlewares/multer.middleware.js";
import { handleMulterUpload } from "../middlewares/handleMulterError.middleware.js";
import cleanupUploadedFiles from "../middlewares/cleanupUploadedFiles.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { passwordChangeLimiter } from "../middlewares/rateLimiter.middleware.js";

const router = Router();

router.route("/me").get(verifyJWT, getCurrentUser);
router.route("/account").patch(verifyJWT, updateAccountDetails);
router.route("/change-password").post(verifyJWT, passwordChangeLimiter, changeCurrentPassword);

router.route("/avatar").patch(
    verifyJWT,
    handleMulterUpload(uploadUserImages.single("avatar"), { avatar: { label: "Avatar", maxSizeMB: 5 } }),
    cleanupUploadedFiles,
    updateAvatar
);

router.route("/cover-image").patch(
    verifyJWT,
    handleMulterUpload(uploadUserImages.single("coverImage"), { coverImage: { label: "Cover image", maxSizeMB: 5 } }),
    cleanupUploadedFiles,
    updateCoverImage
);

router.route("/history").get(verifyJWT, getWatchHistory);

export default router;