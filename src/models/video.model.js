import mongoose, { Schema } from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const assetSchema = new Schema({
    url: { type: String },
    publicId: { type: String },
    format: { type: String },
    bytes: { type: Number },
}, { _id: false });

const videoSchema = new Schema({
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
    },
    description: {
        type: String,
        required: true,
        trim: true,
        maxlength: 5000
    },
    status: {
        type: String,
        enum: ["awaiting_upload", "processing", "ready", "failed"],
        default: "awaiting_upload",
        index: true
    },
    processingError: {
        type: String,
        default: null
    },
    assets: {
        video: assetSchema,
        thumbnail: assetSchema
    },
    duration: {
        type: Number,
        default: 0
    },
    views: {
        type: Number,
        default: 0
    },
    isPublished: {
        type: Boolean,
        default: false
    },
    owner: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    }
}, { timestamps: true });

videoSchema.plugin(mongooseAggregatePaginate);

videoSchema.index({ isPublished: 1, status: 1, createdAt: -1 });
videoSchema.index({ status: 1, createdAt: 1 });

export const Video = mongoose.model("Video", videoSchema);