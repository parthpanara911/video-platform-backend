import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { engagementLimiter } from "../middlewares/rateLimiter.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { channelIdParamsSchema, subscriptionListQuerySchema } from "../validators/subscription.validator.js";
import { subscribe, unsubscribe, getChannelSubscribers, getSubscribedChannels } from "../controllers/subscription.controller.js";

const router = Router();
router.use(verifyJWT);

// Channels I follow
router.route("/channels").get(validate({ query: subscriptionListQuerySchema }), getSubscribedChannels);

router.route("/channels/:channelId")
    .put(engagementLimiter, validate({ params: channelIdParamsSchema }), subscribe)
    .delete(engagementLimiter, validate({ params: channelIdParamsSchema }), unsubscribe);

// Subscribers of a channel (owner only)
router.route("/channels/:channelId/subscribers").get(
    validate({ params: channelIdParamsSchema, query: subscriptionListQuerySchema }),
    getChannelSubscribers
);

export default router;