import { Router } from "express";
import { registerUser, loginUser, logoutUser, refreshAccessToken, getCurrentUser, updateAccountDetails, changeCurrentPassword, updateAvatar, updateCoverImage } from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import cleanupUploadedFiles from "../middlewares/cleanupUploadedFiles.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

// Public routes
router.route("/register").post(
    upload.fields([
        { name: "avatar", maxCount: 1 },
        { name: "coverImage", maxCount: 1 }
    ]),
    cleanupUploadedFiles,
    registerUser
);

router.route("/login").post(loginUser);
router.route("/refresh").post(refreshAccessToken);

// Protected routes
router.route("/logout").post(verifyJWT, logoutUser);
router.route("/me").get(verifyJWT, getCurrentUser);
router.route("/account").patch(verifyJWT, updateAccountDetails);
router.route("/change-password").post(verifyJWT, changeCurrentPassword);

router.route("/avatar").patch(verifyJWT, upload.single("avatar"), cleanupUploadedFiles, updateAvatar);
router.route("/cover-image").patch(verifyJWT, upload.single("coverImage"), cleanupUploadedFiles, updateCoverImage);

export default router;