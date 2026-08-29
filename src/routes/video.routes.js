import { Router } from "express";
import { publishVideo } from "../controllers/video.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import cleanupUploadedFiles from "../middlewares/cleanupUploadedFiles.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/")
    .post(
        verifyJWT,
        upload.fields([
            { name: "videoFile", maxCount: 1 },
            { name: "thumbnail", maxCount: 1 }
        ]),
        cleanupUploadedFiles,
        publishVideo
    );

export default router;