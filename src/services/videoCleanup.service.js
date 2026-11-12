import { Comment } from "../models/comment.model.js";
import { Like } from "../models/like.model.js";
import { VideoView } from "../models/videoView.model.js";
import { Playlist } from "../models/playlist.model.js";
import { toObjectId } from "../utils/objectId.js";

const BATCH = 1000;

/**
 * Cleans up database references when a video is deleted.
 * Removes comment likes before comments, then video likes and playlist entries.
 * Watch history is handled by lookup; Cloudinary assets are handled by deleteVideo.
 * Safe to retry; collects cleanup errors and throws them together.
 */
export const cleanupVideoReferences = async (videoId) => {
    const id = toObjectId(videoId);
    const failures = [];
    const step = async (name, fn) => {
        try {
            await fn();
        } catch (err) {
            failures.push({ name, err });
        }
    };

    let commentsListed = true;
    await step("comment-likes", async () => {
        let batch = [];
        for await (const c of Comment.find({ video: id }).select("_id").lean().cursor()) {
            batch.push(c._id);

            if (batch.length >= BATCH) {
                await Like.deleteMany({
                    targetType: "comment",
                    targetId: { $in: batch }
                });
                batch = [];
            }
        }

        if (batch.length) {
            await Like.deleteMany({
                targetType: "comment", targetId: { $in: batch }
            });
        }
    }).then(() => {
        commentsListed = !failures.some((f) => f.name === "comment-likes");
    });

    // Only drop the comments once their likes are gone; otherwise a re-run could no longer find them.
    if (commentsListed) {
        await step("comments", () => Comment.deleteMany({ video: id }));
    }

    await step("video-likes", () =>
        Like.deleteMany({
            targetType: "video",
            targetId: id
        })
    );

    await step("video-views", () => VideoView.deleteMany({ video: id }));

    await step("playlists", () =>
        Playlist.updateMany(
            { videos: id },
            { $pull: { videos: id } }
        )
    );

    if (failures.length) {
        const error = new Error(
            `Video cleanup incomplete: ${failures.map((f) => f.name).join(", ")}`
        );
        error.failures = failures.map(({ name, err }) => ({
            name,
            message: err?.message
        }));
        throw error;
    }
};