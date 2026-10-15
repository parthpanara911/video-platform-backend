import { z } from "zod";
import { objectId, paginationQuerySchema } from "./common.validator.js";

export const COMMENT_MAX_LENGTH = 1000;

const content = z
    .string({ required_error: "Content is required", invalid_type_error: "Content must be a string" })
    .trim()
    .min(1, "Content cannot be empty")
    .max(COMMENT_MAX_LENGTH, `Content must be at most ${COMMENT_MAX_LENGTH} characters`);

export const videoIdParamsSchema = z.object({ videoId: objectId("video id") });
export const commentIdParamsSchema = z.object({ commentId: objectId("comment id") });

export const createCommentBodySchema = z.object({
    content,
    parentComment: objectId("parent comment id").nullish(),
});

export const updateCommentBodySchema = z.object({ content });

export const commentListQuerySchema = paginationQuerySchema;