import { User } from "../models/user.model.js";
import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import uploadOnCloudinary from "../utils/cloudinary.js";
import ApiResponse from "../utils/ApiResponse.js";
import { cookieOptions } from "../utils/cookies.js";

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
    });

    if (existingUser) {
        throw new ApiError(409, "A user with this username or email already exists");
    }

    const avatarLocalPath = req.files?.avatar?.[0]?.path;
    const coverImageLocalPath = req.files?.coverImage?.[0]?.path;

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required");
    }

    const uploadedAvatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImageUploadResult = await uploadOnCloudinary(coverImageLocalPath);

    if (!uploadedAvatar?.url) {
        throw new ApiError(400, "Failed to upload avatar image");
    }

    const user = await User.create({
        fullName: normalizedFullName,
        username: normalizedUsername,
        email: normalizedEmail,
        password,
        avatar: uploadedAvatar.secure_url,
        coverImage: coverImageUploadResult?.secure_url || "",
    });

    const createdUser = await User.findById(user._id).select("-password -refreshToken");

    if (!createdUser) {
        throw new ApiError(500, "Something went wrong while registering the user");
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

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken");

    return res.status(200)
        .cookie("accessToken", accessToken, cookieOptions.accessToken)
        .cookie("refreshToken", refreshToken, cookieOptions.refreshToken)
        .json(new ApiResponse(200, { user: loggedInUser }, "User logged in successfully"));
});

const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(req.user._id,
        {
            $unset: {
                refreshToken: 1
            }
        },
        { new: true }
    );

    return res.status(200)
        .clearCookie("accessToken", cookieOptions.accessToken)
        .clearCookie("refreshToken", cookieOptions.refreshToken)
        .json(new ApiResponse(200, {}, "User logged out successfully"));
});

export { registerUser, loginUser, logoutUser };