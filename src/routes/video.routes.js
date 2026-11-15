import { Router } from "express";
import { initiateVideoUpload, getVideoStatus, getAllVideos, getVideoById, updateVideoDetails, issueThumbnailUpload, deleteVideo, togglePublishStatus, recordVideoView } from "../controllers/video.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { optionalAuth } from "../middlewares/optionalAuth.middleware.js";
import { uploadInitiateLimiter, thumbnailSignLimiter, viewLimiter } from "../middlewares/rateLimiter.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { videoIdParamsSchema, updateVideoMetadataSchema } from "../validators/video.validator.js";

const router = Router();

router.route("/")
    .get(optionalAuth, getAllVideos)
    .post(verifyJWT, uploadInitiateLimiter, initiateVideoUpload);

router.route("/:videoId/status").get(verifyJWT, getVideoStatus);

router.route("/:videoId/thumbnail/upload-url").post(
    verifyJWT,
    thumbnailSignLimiter,
    validate({ params: videoIdParamsSchema }),
    issueThumbnailUpload
);

router.route("/:videoId")
    .get(optionalAuth, getVideoById)
    .patch(
        verifyJWT,
        validate({ params: videoIdParamsSchema, body: updateVideoMetadataSchema }),
        updateVideoDetails
    )
    .delete(verifyJWT, deleteVideo);

router.route("/:videoId/toggle-publish").patch(verifyJWT, togglePublishStatus);

router.route("/:videoId/view").post(
    optionalAuth,
    viewLimiter,
    validate({ params: videoIdParamsSchema }),
    recordVideoView
);

export default router;