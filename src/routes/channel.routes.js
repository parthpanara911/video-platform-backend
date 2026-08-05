import { Router } from "express";
import { getUserChannelProfile } from "../controllers/user.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/:username").get(verifyJWT, getUserChannelProfile);

export default router;