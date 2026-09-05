import { Router } from "express";
import { publishVideo, getAllVideos, getVideoById, updateVideoDetails, deleteVideo, togglePublishStatus } from "../controllers/video.controller.js";
import { uploadVideoAssets, uploadThumbnailOnly } from "../middlewares/multer.middleware.js";
import { handleMulterUpload } from "../middlewares/handleMulterError.middleware.js";
import cleanupUploadedFiles from "../middlewares/cleanupUploadedFiles.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { optionalAuth } from "../middlewares/optionalAuth.middleware.js";

const router = Router();

router.route("/")
    .get(optionalAuth, getAllVideos)
    .post(
        verifyJWT,
        handleMulterUpload(
            uploadVideoAssets.fields([
                { name: "videoFile", maxCount: 1 },
                { name: "thumbnail", maxCount: 1 }
            ]),
            {
                videoFile: { label: "Video", maxSizeMB: 200 },
                thumbnail: { label: "Thumbnail", maxSizeMB: 5 }
            }
        ),
        cleanupUploadedFiles,
        publishVideo
    );

router.route("/:videoId")
    .get(optionalAuth, getVideoById)
    .patch(
        verifyJWT,
        handleMulterUpload(
            uploadThumbnailOnly.single("thumbnail"),
            { thumbnail: { label: "Thumbnail", maxSizeMB: 5 } }
        ),
        cleanupUploadedFiles,
        updateVideoDetails
    )
    .delete(verifyJWT, deleteVideo);

router.route("/:videoId/toggle-publish").patch(verifyJWT, togglePublishStatus);

export default router;