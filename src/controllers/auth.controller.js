import { User } from "../models/user.model.js";
import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import { uploadOnCloudinary } from "../utils/cloudinaryService.js";
import { validateImageFile } from "../utils/validateFile.js";
import ApiResponse from "../utils/ApiResponse.js";
import { cookieOptions } from "../utils/cookies.js";
import jwt from "jsonwebtoken";

const generateAccessAndRefreshTokens = async (userId) => {
    try {
        const user = await User.findById(userId);
        if (!user) {
            throw new ApiError(404, "User not found");
        }

        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });

        return { accessToken, refreshToken };
    } catch (error) {
        throw new ApiError(500, "Failed to generate access and refresh tokens");
    }
};

const registerUser = asyncHandler(async (req, res) => {
    const { fullName, username, email, password } = req.body;

    if (
        [fullName, username, email, password].some((field) => !field || field.trim() === "")
    ) {
        throw new ApiError(400, "Full name, username, email, and password are required");
    }

    const normalizedFullName = fullName.trim();
    const normalizedUsername = username.trim().toLowerCase();
    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({
        $or: [
            { username: normalizedUsername },
            { email: normalizedEmail }
        ]
    }).lean();

    if (existingUser) {
        throw new ApiError(409, "A user with this username or email already exists");
    }

    const avatarLocalPath = req.files?.avatar?.[0]?.path;
    const coverImageLocalPath = req.files?.coverImage?.[0]?.path;

    if (!avatarLocalPath) {
        throw new ApiError(400, "Please upload an avatar image");
    }

    await validateImageFile(avatarLocalPath, "Avatar");

    if (coverImageLocalPath) {
        await validateImageFile(coverImageLocalPath, "Cover image");
    }

    const uploadedAvatar = await uploadOnCloudinary(avatarLocalPath);
    const uploadedCoverImage = await uploadOnCloudinary(coverImageLocalPath);

    if (!uploadedAvatar?.secure_url) {
        throw new ApiError(400, "Failed to upload the avatar image");
    }

    const user = await User.create({
        fullName: normalizedFullName,
        username: normalizedUsername,
        email: normalizedEmail,
        password,
        avatar: uploadedAvatar.secure_url,
        avatarPublicId: uploadedAvatar.public_id,
        coverImage: uploadedCoverImage?.secure_url || "",
        coverImagePublicId: uploadedCoverImage?.public_id || "",
    });

    const createdUser = await User.findById(user._id)
        .select("-password -refreshToken")
        .lean();

    if (!createdUser) {
        throw new ApiError(500, "Failed to create the user account. Please try again.");
    }

    return res.status(201).json(
        new ApiResponse(201, createdUser, "User account created successfully")
    );
});

const loginUser = asyncHandler(async (req, res) => {
    const { username, email, password } = req.body;

    const normalizedUsername = username?.trim().toLowerCase();
    const normalizedEmail = email?.trim().toLowerCase();

    if (!normalizedUsername && !normalizedEmail) {
        throw new ApiError(400, "Username or email is required");
    }

    if (!password?.trim()) {
        throw new ApiError(400, "Password is required");
    }

    const user = await User.findOne({
        $or: [
            { username: normalizedUsername },
            { email: normalizedEmail }
        ]
    });

    if (!user) {
        throw new ApiError(401, "Invalid credentials");
    }

    const isPasswordValid = await user.isPasswordCorrect(password);

    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid password");
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id);

    const loggedInUser = await User.findById(user._id)
        .select("-password -refreshToken")
        .lean();

    return res.status(200)
        .cookie("accessToken", accessToken, cookieOptions.accessToken)
        .cookie("refreshToken", refreshToken, cookieOptions.refreshToken)
        .json(new ApiResponse(200, { user: loggedInUser }, "User logged in successfully"));
});

const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: { refreshToken: 1 }
        }
    );

    return res.status(200)
        .clearCookie("accessToken", cookieOptions.accessToken)
        .clearCookie("refreshToken", cookieOptions.refreshToken)
        .json(new ApiResponse(200, {}, "User logged out successfully"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies?.refreshToken;

    if (!incomingRefreshToken) {
        throw new ApiError(401, "Unauthorized request");
    }

    try {
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);
        const user = await User.findById(decodedToken?._id);

        if (!user) {
            throw new ApiError(401, "Invalid refresh token");
        }

        if (incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "Refresh token is invalid or has been revoked");
        }

        const { accessToken, refreshToken: newRefreshToken } = await generateAccessAndRefreshTokens(user._id);

        return res.status(200)
            .cookie("accessToken", accessToken, cookieOptions.accessToken)
            .cookie("refreshToken", newRefreshToken, cookieOptions.refreshToken)
            .json(new ApiResponse(200, {}, "Access token refreshed successfully"));
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token");
    }
});

export { registerUser, loginUser, logoutUser, refreshAccessToken };