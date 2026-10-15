import { z } from "zod";

export const objectId = (label = "id") =>
    z.string({
        invalid_type_error: `Invalid ${label}`,
        required_error: `Invalid ${label}`,
    })
        .refine((v) => /^[0-9a-fA-F]{24}$/.test(v), `Invalid ${label}`);

export const MAX_PAGE_SIZE = 50;

export const paginationShape = {
    page: z.coerce
        .number({ invalid_type_error: "page must be a number" })
        .int("page must be an integer")
        .min(1, "page must be at least 1")
        .max(10000, "page is too large")
        .default(1),
    limit: z.coerce
        .number({ invalid_type_error: "limit must be a number" })
        .int("limit must be an integer")
        .min(1, "limit must be at least 1")
        .max(MAX_PAGE_SIZE, `limit must be at most ${MAX_PAGE_SIZE}`)
        .default(10),
};

export const paginationQuerySchema = z.object(paginationShape);