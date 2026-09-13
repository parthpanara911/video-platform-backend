import { User } from "../models/user.model.js";
import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import { uploadOnCloudinary, deleteFromCloudinary } from "../utils/cloudinaryService.js";
import { validateImageFile } from "../utils/validateFile.js";
import ApiResponse from "../utils/ApiResponse.js";
import mongoose from "mongoose";

const getCurrentUser = asyncHandler(async (req, res) => {
    return res.status(200)
        .json(new ApiResponse(200, req.user, "Current user retrieved successfully"));
});

const updateAccountDetails = asyncHandler(async (req, res) => {
    const { fullName, email } = req.body;

    if (!fullName?.trim() || !email?.trim()) {
        throw new ApiError(400, "Full name and email are required");
    }

    const normalizedFullName = fullName.trim();
    const normalizedEmail = email.trim().toLowerCase();

    const currentUser = await User.findById(req.user?._id)
        .select("fullName email");

    if (!currentUser) {
        throw new ApiError(404, "User not found");
    }

    if (normalizedEmail !== currentUser.email) {
        const existingUser = await User.exists({
            email: normalizedEmail,
            _id: { $ne: currentUser._id }
        });

        if (existingUser) {
            throw new ApiError(409, "Email address is already in use");
        }
    }

    try {
        const updatedUser = await User.findByIdAndUpdate(
            currentUser._id,
            {
                $set: {
                    fullName: normalizedFullName,
                    email: normalizedEmail
                }
            },
            {
                returnDocument: 'after',
                runValidators: true
            }
        )
            .select("-password -refreshToken")
            .lean();

        if (!updatedUser) {
            throw new ApiError(404, "User not found");
        }

        return res.status(200)
            .json(new ApiResponse(200, updatedUser, "Account details updated successfully"));
    } catch (error) {
        if (error?.code === 11000) {
            throw new ApiError(409, "Email address is already in use");
        }
        throw error;
    }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword?.trim() || !newPassword?.trim()) {
        throw new ApiError(400, "Old password and new password are required");
    }

    if (oldPassword === newPassword) {
        throw new ApiError(400, "New password must be different from the current password");
    }

    const user = await User.findById(req.user?._id);
    const isCurrentPasswordValid = await user.isPasswordCorrect(oldPassword);

    if (!isCurrentPasswordValid) {
        throw new ApiError(400, "Current password is incorrect");
    }

    user.password = newPassword;
    await user.save({ validateBeforeSave: false });

    return res.status(200)
        .json(new ApiResponse(200, {}, "Password changed successfully"));
});

const updateAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.file?.path;
    if (!avatarLocalPath) {
        throw new ApiError(400, "Please upload an avatar image");
    }

    await validateImageFile(avatarLocalPath, "Avatar");

    const uploadedAvatar = await uploadOnCloudinary(avatarLocalPath);
    if (!uploadedAvatar?.secure_url || !uploadedAvatar?.public_id) {
        throw new ApiError(400, "Failed to upload the avatar image");
    }

    const user = await User.findById(req.user?._id);
    if (!user) {
        throw new ApiError(404, "User not found");
    }

    const oldAvatarPublicId = user.avatarPublicId;

    user.avatar = uploadedAvatar.secure_url;
    user.avatarPublicId = uploadedAvatar.public_id;

    await user.save({ validateBeforeSave: false });

    if (oldAvatarPublicId) {
        try {
            await deleteFromCloudinary(oldAvatarPublicId);
        } catch (error) {
            console.error(`Failed to delete old avatar from Cloudinary: ${oldAvatarPublicId}`, error);
        }
    }

    const updatedUser = await User.findById(user._id)
        .select("-password -refreshToken")
        .lean();

    return res.status(200)
        .json(new ApiResponse(200, updatedUser, "Avatar image updated successfully"));
});

const updateCoverImage = asyncHandler(async (req, res) => {
    const coverImageLocalPath = req.file?.path;
    if (!coverImageLocalPath) {
        throw new ApiError(400, "Please upload a cover image");
    }

    await validateImageFile(coverImageLocalPath, "Cover image");

    const uploadedCoverImage = await uploadOnCloudinary(coverImageLocalPath);
    if (!uploadedCoverImage?.secure_url || !uploadedCoverImage?.public_id) {
        throw new ApiError(500, "Failed to upload the cover image");
    }

    const user = await User.findById(req.user?._id);
    if (!user) {
        throw new ApiError(404, "User not found");
    }

    const oldCoverImagePublicId = user.coverImagePublicId;

    user.coverImage = uploadedCoverImage.secure_url;
    user.coverImagePublicId = uploadedCoverImage.public_id;

    await user.save({ validateBeforeSave: false });

    if (oldCoverImagePublicId) {
        try {
            await deleteFromCloudinary(oldCoverImagePublicId);
        } catch (error) {
            console.error(`Failed to delete old cover image from Cloudinary: ${oldCoverImagePublicId}`, error);
        }
    }

    const updatedUser = await User.findById(user._id)
        .select("-password -refreshToken")
        .lean();

    return res.status(200)
        .json(new ApiResponse(200, updatedUser, "Cover image updated successfully"));
});

const getUserChannelProfile = asyncHandler(async (req, res) => {
    const { username } = req.params;

    if (!username?.trim()) {
        throw new ApiError(400, "Username is required");
    }

    const normalizedUsername = username.trim().toLowerCase();

    const [channelProfile] = await User.aggregate([
        {
            $match: {
                username: normalizedUsername
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields: {
                subscriberCount: {
                    $size: "$subscribers"
                },
                subscribedChannelsCount: {
                    $size: "$subscribedTo"
                },
                isSubscribed: {
                    $cond: {
                        if: { $in: [req.user?._id, "$subscribers.subscriber"] },
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                fullName: 1,
                username: 1,
                subscriberCount: 1,
                subscribedChannelsCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1
            }
        }
    ]);

    if (!channelProfile) {
        throw new ApiError(404, "Channel not found");
    }

    return res.status(200)
        .json(new ApiResponse(200, channelProfile, "Channel profile retrieved successfully"));
});

const getWatchHistory = asyncHandler(async (req, res) => {
    const [user] = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user?._id)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        fullName: 1,
                                        username: 1,
                                        avatar: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields: {
                            owner: {
                                $first: "$owner"
                            }
                        }
                    },
                    {
                        $project: {
                            thumbnail: 1,
                            title: 1,
                            duration: 1,
                            views: 1,
                            owner: 1,
                            createdAt: 1,
                        }
                    }
                ]
            }
        }
    ]);

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    return res.status(200)
        .json(new ApiResponse(200, user.watchHistory, "Watch history retrieved successfully"));
});

export { getCurrentUser, updateAccountDetails, changeCurrentPassword, updateAvatar, updateCoverImage, getUserChannelProfile, getWatchHistory };