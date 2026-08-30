import { Router } from "express";
import { publishVideo, getAllVideos, getVideoById } from "../controllers/video.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import cleanupUploadedFiles from "../middlewares/cleanupUploadedFiles.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { optionalAuth } from "../middlewares/optionalAuth.middleware.js";

const router = Router();

router.route("/")
    .get(optionalAuth, getAllVideos)
    .post(
        verifyJWT,
        upload.fields([
            { name: "videoFile", maxCount: 1 },
            { name: "thumbnail", maxCount: 1 }
        ]),
        cleanupUploadedFiles,
        publishVideo
    );

router.route("/:videoId")
    .get(optionalAuth, getVideoById);

export default router;