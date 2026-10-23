import mongoose, { Schema } from "mongoose";

export const LIKE_TARGET_TYPES = ["video", "comment"];

const likeSchema = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    targetType: {
        type: String,
        enum: LIKE_TARGET_TYPES,
        required: true
    },
    targetId: {
        type: Schema.Types.ObjectId,
        required: true
    }
}, { timestamps: true });

likeSchema.index({ user: 1, targetType: 1, targetId: 1 }, { unique: true });

likeSchema.index({ targetId: 1, targetType: 1 });

likeSchema.index({ user: 1, targetType: 1, createdAt: -1, _id: -1 });

export const Like = mongoose.model("Like", likeSchema);