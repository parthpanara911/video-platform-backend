import mongoose, { Schema } from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const commentSchema = new Schema(
    {
        content: {
            type: String,
            required: true,
            trim: true,
            minlength: 1,
            maxlength: 1000
        },
        video: {
            type: Schema.Types.ObjectId,
            ref: "Video",
            required: true
        },
        owner: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        parentComment: {
            type: Schema.Types.ObjectId,
            ref: "Comment",
            default: null
        },
        isDeleted: {
            type: Boolean,
            default: false
        },
        editedAt: {
            type: Date,
            default: null
        }
    }, { timestamps: true });

commentSchema.plugin(mongooseAggregatePaginate);

commentSchema.index({ video: 1, parentComment: 1, createdAt: -1, _id: -1 });

commentSchema.index({ parentComment: 1, createdAt: 1, _id: 1 });

export const Comment = mongoose.model("Comment", commentSchema);