import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { optionalAuth } from "../middlewares/optionalAuth.middleware.js";
import { engagementLimiter } from "../middlewares/rateLimiter.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
    playlistIdParamsSchema, playlistVideoParamsSchema, createPlaylistBodySchema,
    updatePlaylistBodySchema, playlistListQuerySchema, playlistDetailQuerySchema,
} from "../validators/playlist.validator.js";
import {
    createPlaylist, getMyPlaylists, getPlaylistById, updatePlaylist, deletePlaylist,
    addVideoToPlaylist, removeVideoFromPlaylist,
} from "../controllers/playlist.controller.js";

const router = Router();

router.route("/")
    .get(verifyJWT, validate({ query: playlistListQuerySchema }), getMyPlaylists)
    .post(verifyJWT, engagementLimiter, validate({ body: createPlaylistBodySchema }), createPlaylist);

router.route("/:playlistId/videos/:videoId")
    .put(verifyJWT, engagementLimiter, validate({ params: playlistVideoParamsSchema }), addVideoToPlaylist)
    .delete(verifyJWT, engagementLimiter, validate({ params: playlistVideoParamsSchema }), removeVideoFromPlaylist);

router.route("/:playlistId")
    .get(optionalAuth, validate({ params: playlistIdParamsSchema, query: playlistDetailQuerySchema }), getPlaylistById)
    .patch(
        verifyJWT, engagementLimiter,
        validate({ params: playlistIdParamsSchema, body: updatePlaylistBodySchema }),
        updatePlaylist
    )
    .delete(verifyJWT, engagementLimiter, validate({ params: playlistIdParamsSchema }), deletePlaylist);

export default router;