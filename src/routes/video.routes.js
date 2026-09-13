import { Router } from "express";
import { initiateVideoUpload, getVideoStatus, getAllVideos, getVideoById, updateVideoDetails, deleteVideo, togglePublishStatus } from "../controllers/video.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { optionalAuth } from "../middlewares/optionalAuth.middleware.js";
import { uploadInitiateLimiter } from "../middlewares/rateLimiter.middleware.js";

const router = Router();

router.route("/")
    .get(optionalAuth, getAllVideos)
    .post(verifyJWT, uploadInitiateLimiter, initiateVideoUpload);

router.route("/:videoId/status").get(verifyJWT, getVideoStatus);

router.route("/:videoId")
    .get(optionalAuth, getVideoById)
    .patch(verifyJWT, updateVideoDetails)
    .delete(verifyJWT, deleteVideo);

router.route("/:videoId/toggle-publish").patch(verifyJWT, togglePublishStatus);

export default router;