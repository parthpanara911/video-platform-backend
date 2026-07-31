import { User } from "../models/user.model.js";
import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import uploadOnCloudinary from "../utils/cloudinary.js";
import ApiResponse from "../utils/ApiResponse.js";

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
        avatar: uploadedAvatar.url,
        coverImage: coverImageUploadResult?.url || "",
        username: normalizedUsername,
        email: normalizedEmail,
        password
    });

    const createdUser = await User.findById(user._id).select("-password -refreshToken");

    if (!createdUser) {
        throw new ApiError(500, "Something went wrong while registering the user");
    }

    return res.status(201).json(
        new ApiResponse(201, createdUser, "User account created successfully")
    );
});

export { registerUser };