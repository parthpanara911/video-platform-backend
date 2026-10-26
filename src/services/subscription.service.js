import { Subscription } from "../models/subscription.model.js";
import { User } from "../models/user.model.js";
import ApiError from "../utils/ApiError.js";
import { isDuplicateKeyError } from "../utils/mongoErrors.js";
import { buildPage, skipFor } from "../utils/pagination.js";
import { sameId, toObjectId } from "../utils/objectId.js";

// Returns the total number of subscribers for a channel.
const countSubscribers = (channelId) =>
    Subscription.countDocuments({ channel: channelId });

/**
 * Subscribes a user to a channel if they aren't already subscribed.
 * Returns the subscription status and updated subscriber count.
 */
export const subscribe = async ({ subscriberId, channelId }) => {
    if (sameId(subscriberId, channelId)) {
        throw new ApiError(400, "You cannot subscribe to your own channel");
    }

    if (!(await User.exists({ _id: channelId }))) {
        throw new ApiError(404, "Channel not found");
    }

    let created = false;
    try {
        const res = await Subscription.updateOne(
            { subscriber: subscriberId, channel: channelId },
            { $setOnInsert: { subscriber: subscriberId, channel: channelId } },
            { upsert: true }
        );
        created = res.upsertedCount > 0;
    } catch (err) {
        if (!isDuplicateKeyError(err)) throw err;
    }

    return {
        channelId,
        isSubscribed: true,
        subscriberCount: await countSubscribers(channelId),
        changed: created,
    };
};

/**
 * Removes a user's subscription and returns the updated subscriber count.
 */
export const unsubscribe = async ({ subscriberId, channelId }) => {
    const res = await Subscription.deleteOne({ subscriber: subscriberId, channel: channelId });

    if (res.deletedCount === 0 && !(await User.exists({ _id: channelId }))) {
        throw new ApiError(404, "Channel not found");
    }

    return {
        channelId,
        isSubscribed: false,
        subscriberCount: await countSubscribers(channelId),
        changed: res.deletedCount > 0,
    };
};

/**
 * Returns a paginated list of subscribers visible to the channel owner.
 */
export const listSubscribers = async ({ channelId, requesterId, page, limit }) => {
    if (!sameId(channelId, requesterId)) {
        throw new ApiError(403, "Only the channel owner can view the subscriber list");
    }

    const channel = toObjectId(channelId);

    const [docs, totalDocs] = await Promise.all([
        Subscription.aggregate([
            { $match: { channel } },
            { $sort: { createdAt: -1, _id: -1 } },
            { $skip: skipFor(page, limit) },
            { $limit: limit },
            {
                $lookup: {
                    from: "users",
                    localField: "subscriber",
                    foreignField: "_id",
                    as: "subscriber",
                    pipeline: [{ $project: { fullName: 1, username: 1, avatar: 1 } }],
                },
            },
            {
                $addFields: { subscriber: { $first: "$subscriber" } }
            },
            {
                $project: { _id: 0, subscriber: 1, subscribedAt: "$createdAt" }
            },
        ]),
        countSubscribers(channel),
    ]);

    return buildPage({ docs, totalDocs, page, limit });
};

/**
 * Returns a paginated list of channels the user is subscribed to.
 */
export const listSubscribedChannels = async ({ subscriberId, page, limit }) => {
    const subscriber = toObjectId(subscriberId);

    const [docs, totalDocs] = await Promise.all([
        Subscription.aggregate([
            { $match: { subscriber } },
            { $sort: { createdAt: -1, _id: -1 } },
            { $skip: skipFor(page, limit) },
            { $limit: limit },
            {
                $lookup: {
                    from: "users",
                    localField: "channel",
                    foreignField: "_id",
                    as: "channel",
                    pipeline: [{ $project: { fullName: 1, username: 1, avatar: 1 } }],
                },
            },
            {
                $addFields: { channel: { $first: "$channel" } }
            },
            {
                $project: { _id: 0, channel: 1, subscribedAt: "$createdAt" }
            },
        ]),
        Subscription.countDocuments({ subscriber }),
    ]);

    return buildPage({ docs, totalDocs, page, limit });
};