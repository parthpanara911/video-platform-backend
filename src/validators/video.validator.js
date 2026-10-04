import { z } from "zod";
import mongoose from "mongoose";

const objectId = z
    .string({
        invalid_type_error: "Invalid video id",
        required_error: "Invalid video id"
    })
    .refine((v) => mongoose.isValidObjectId(v), "Invalid video id");

const optionalTrimmed = (max, label) =>
    z.preprocess(
        (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
        z.string({
            invalid_type_error: `${label} must be a string`
        })
            .trim()
            .max(max, `${label} must be at most ${max} characters`)
            .optional()
    );

export const videoIdParamsSchema = z.object({ videoId: objectId });

export const updateVideoMetadataSchema = z
    .object({
        title: optionalTrimmed(100, "Title"),
        description: optionalTrimmed(5000, "Description"),
    })
    .refine(
        (d) => d.title !== undefined || d.description !== undefined,
        { message: "Provide at least one of title or description" }
    );