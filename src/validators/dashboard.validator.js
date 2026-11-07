import { z } from "zod";
import { paginationShape } from "./common.validator.js";

export const DASHBOARD_VIDEO_STATES = ["published", "unpublished", "processing", "failed"];
export const DASHBOARD_SORT_FIELDS = ["createdAt", "views", "duration", "title"];

export const dashboardVideosQuerySchema = z.object({
    ...paginationShape,
    state: z.enum(DASHBOARD_VIDEO_STATES, {
        errorMap: () => ({ message: `state must be one of: ${DASHBOARD_VIDEO_STATES.join(", ")}` }),
    }).optional(),

    sortBy: z.enum(DASHBOARD_SORT_FIELDS, {
        errorMap: () => ({ message: `sortBy must be one of: ${DASHBOARD_SORT_FIELDS.join(", ")}` }),
    }).default("createdAt"),

    sortType: z.enum(["asc", "desc"], {
        errorMap: () => ({ message: "sortType must be asc or desc" }),
    }).default("desc"),
}).strict();