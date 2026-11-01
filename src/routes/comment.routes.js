import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { optionalAuth } from "../middlewares/optionalAuth.middleware.js";
import { commentWriteLimiter } from "../middlewares/rateLimiter.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
    videoIdParamsSchema, commentIdParamsSchema, createCommentBodySchema,
    updateCommentBodySchema, commentListQuerySchema
} from "../validators/comment.validator.js";
import { getVideoComments, getCommentReplies, addComment, updateComment, deleteComment } from "../controllers/comment.controller.js";

const router = Router();

router.route("/videos/:videoId")
    .get(optionalAuth, validate({ params: videoIdParamsSchema, query: commentListQuerySchema }), getVideoComments)
    .post(
        verifyJWT, commentWriteLimiter,
        validate({ params: videoIdParamsSchema, body: createCommentBodySchema }),
        addComment
    );

router.route("/:commentId/replies").get(
    optionalAuth,
    validate({ params: commentIdParamsSchema, query: commentListQuerySchema }),
    getCommentReplies
);

router.route("/:commentId")
    .patch(
        verifyJWT, commentWriteLimiter,
        validate({ params: commentIdParamsSchema, body: updateCommentBodySchema }),
        updateComment
    )
    .delete(verifyJWT, commentWriteLimiter, validate({ params: commentIdParamsSchema }), deleteComment);

export default router;