import express, { Router } from "express";
import { handleCloudinaryNotification } from "../controllers/webhook.controller.js";
import { verifyCloudinaryWebhook } from "../middlewares/verifyCloudinaryWebhook.middleware.js";

const router = Router();

router.post(
    "/cloudinary",
    express.raw({ type: "application/json", limit: "1mb" }),
    verifyCloudinaryWebhook,
    handleCloudinaryNotification
);

export default router;