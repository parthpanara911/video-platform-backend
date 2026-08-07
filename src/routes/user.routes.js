import { Router } from "express";
import { getCurrentUser, updateAccountDetails, changeCurrentPassword, updateAvatar, updateCoverImage, getWatchHistory } from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import cleanupUploadedFiles from "../middlewares/cleanupUploadedFiles.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/me").get(verifyJWT, getCurrentUser);
router.route("/account").patch(verifyJWT, updateAccountDetails);
router.route("/change-password").post(verifyJWT, changeCurrentPassword);

router.route("/avatar").patch(verifyJWT, upload.single("avatar"), cleanupUploadedFiles, updateAvatar);
router.route("/cover-image").patch(verifyJWT, upload.single("coverImage"), cleanupUploadedFiles, updateCoverImage);

router.route("/history").get(verifyJWT, getWatchHistory);

export default router;