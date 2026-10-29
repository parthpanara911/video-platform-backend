import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { engagementLimiter } from "../middlewares/rateLimiter.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { likeTargetParamsSchema, likedVideosQuerySchema } from "../validators/like.validator.js";
import { likeTarget, unlikeTarget, getLikedVideos } from "../controllers/like.controller.js";

const router = Router();
router.use(verifyJWT);

router.route("/videos").get(validate({ query: likedVideosQuerySchema }), getLikedVideos);

router.route("/:targetType/:targetId")
    .put(engagementLimiter, validate({ params: likeTargetParamsSchema }), likeTarget)
    .delete(engagementLimiter, validate({ params: likeTargetParamsSchema }), unlikeTarget);

export default router;