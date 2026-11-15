import crypto from "crypto";
import { Video } from "../models/video.model.js";
import { VideoView } from "../models/videoView.model.js";
import { User } from "../models/user.model.js";
import redisClient from "../config/redisClient.js";
import logger from "../utils/logger.js";
import { isDuplicateKeyError } from "../utils/mongoErrors.js";
import { toObjectId } from "../utils/objectId.js";

const ANONYMOUS_VIEW_COOLDOWN_SECONDS = 24 * 60 * 60;
const MAX_WATCH_HISTORY = 10;

/**
 * Registers a video view for a logged-in or anonymous viewer.
 * Counts the view only when it has not already been counted within the applicable deduplication period.
 */
export const registerView = async ({ videoId, viewerId, ip, userAgent }) => {
    try {
        let isNewView = false;

        if (viewerId) {
            try {
                const res = await VideoView.updateOne(
                    { video: videoId, viewer: viewerId },
                    { $setOnInsert: { video: videoId, viewer: viewerId } },
                    { upsert: true }
                );
                isNewView = res.upsertedCount > 0;
            } catch (err) {
                if (!isDuplicateKeyError(err)) throw err;
            }
        } else {
            const fingerprint = crypto
                .createHash("sha256")
                .update(`${ip}|${userAgent ?? ""}`)
                .digest("hex")
                .slice(0, 32);

            const result = await redisClient.set(
                `view:${videoId}:${fingerprint}`,
                "1",
                "EX",
                ANONYMOUS_VIEW_COOLDOWN_SECONDS,
                "NX"
            );
            isNewView = result === "OK";
        }

        if (isNewView) {
            await Video.updateOne(
                { _id: videoId },
                { $inc: { views: 1 } }
            );
        }
        return isNewView;
    } catch (err) {
        logger.warn({ err, videoId }, "Failed to register view");
        return false;
    }
};

/**
 * Adds the watched video to the beginning of the user's watch history.
 * Removes duplicate entries and keeps only the latest videos up to the configured history limit.
 */
export const touchWatchHistory = async ({ userId, videoId }) => {
    const vid = toObjectId(videoId);

    try {
        await User.updateOne({ _id: userId }, [
            {
                $set: {
                    watchHistory: {
                        $slice: [
                            {
                                $concatArrays: [
                                    [vid],
                                    {
                                        $filter: {
                                            input: {
                                                $ifNull: ["$watchHistory", []]
                                            },
                                            cond: {
                                                $ne: ["$$this", vid]
                                            },
                                        },
                                    },
                                ],
                            },
                            MAX_WATCH_HISTORY,
                        ],
                    },
                },
            },
        ],
            { updatePipeline: true }
        );
    } catch (err) {
        logger.warn({ err, userId, videoId }, "Failed to update watch history");
    }
};