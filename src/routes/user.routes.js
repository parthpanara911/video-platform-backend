import { Router } from "express";
import { registerUser, loginUser, logoutUser } from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import cleanupUploadedFiles from "../middlewares/cleanupUploadedFiles.middleware.js";
import { verifyToken } from "../middlewares/auth.middleware.js";

const router = Router();

// Register
router.route('/register').post(
    upload.fields([
        { name: "avatar", maxCount: 1 },
        { name: "coverImage", maxCount: 1 }
    ]),
    cleanupUploadedFiles,
    registerUser
);

// Login
router.route('/login').post(loginUser);

// Logout
router.route('/logout').post(verifyToken, logoutUser);

export default router;