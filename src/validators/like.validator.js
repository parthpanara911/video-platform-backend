import { z } from "zod";
import { objectId, paginationQuerySchema } from "./common.validator.js";

const ROUTE_TO_TARGET_TYPE = { videos: "video", comments: "comment" };

export const likeTargetParamsSchema = z.object({
    targetType: z
        .string({ required_error: "Invalid target type", invalid_type_error: "Invalid target type" })
        .refine((v) => Object.hasOwn(ROUTE_TO_TARGET_TYPE, v), "Invalid target type. Use 'videos' or 'comments'")
        .transform((v) => ROUTE_TO_TARGET_TYPE[v]),
    targetId: objectId("target id"),
});

export const likedVideosQuerySchema = paginationQuerySchema;