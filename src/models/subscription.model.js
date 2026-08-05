import mongoose, { Schema } from "mongoose";

const subscriptionSchema = new Schema({
    subscriber: {     // the user who subscribed to a channel
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    channel: {       // the channel (user) being subscribed to
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

}, { timestamps: true });

subscriptionSchema.index(
    { subscriber: 1, channel: 1 },
    { unique: true }
);

export const Subscription = mongoose.model('Subscription', subscriptionSchema);