import mongoose, { Schema } from "mongoose";

export const PLAYLIST_VISIBILITY = ["private", "unlisted", "public"];

const playlistSchema = new Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        minlength: 1,
        maxlength: 100
    },
    description: {
        type: String,
        trim: true,
        maxlength: 500,
        default: ""
    },
    visibility: {
        type: String,
        enum: PLAYLIST_VISIBILITY,
        default: "private"
    },
    videos: [
        {
            type: Schema.Types.ObjectId,
            ref: "Video"
        }
    ],
    owner: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    }
}, { timestamps: true });

playlistSchema.index({ owner: 1, createdAt: -1, _id: -1 });

playlistSchema.index({ videos: 1 });

export const Playlist = mongoose.model("Playlist", playlistSchema);