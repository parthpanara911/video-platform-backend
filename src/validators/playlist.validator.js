import { z } from "zod";
import { objectId, paginationQuerySchema, paginationShape } from "./common.validator.js";

export const PLAYLIST_VISIBILITY = ["private", "unlisted", "public"];

const name = z
    .string({ required_error: "Name is required", invalid_type_error: "Name must be a string" })
    .trim()
    .min(1, "Name cannot be empty")
    .max(100, "Name must be at most 100 characters");

const description = z
    .string({ invalid_type_error: "Description must be a string" })
    .trim()
    .max(500, "Description must be at most 500 characters");

const visibility = z.enum(PLAYLIST_VISIBILITY, {
    errorMap: () => ({ message: `Visibility must be one of: ${PLAYLIST_VISIBILITY.join(", ")}` }),
});

export const playlistIdParamsSchema = z.object({ playlistId: objectId("playlist id") });
export const playlistVideoParamsSchema = z.object({
    playlistId: objectId("playlist id"),
    videoId: objectId("video id"),
});

export const createPlaylistBodySchema = z.object({
    name,
    description: description.default(""),
    visibility: visibility.default("private"),
});

export const updatePlaylistBodySchema = z
    .object({
        name: name.optional(),
        description: description.optional(),
        visibility: visibility.optional(),
    })
    .refine(
        (d) => d.name !== undefined || d.description !== undefined || d.visibility !== undefined,
        { message: "Provide at least one of name, description or visibility" }
    );

export const playlistListQuerySchema = z.object({
    ...paginationShape,
    visibility: visibility.optional(),
});

export const playlistDetailQuerySchema = paginationQuerySchema;