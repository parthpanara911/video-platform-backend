import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";

export const verifyToken = asyncHandler(async (req, res, next) => {
    try {
        const authHeader = req.header("Authorization");
        const accessToken =
            req.cookies?.accessToken ||
            (authHeader?.startsWith("Bearer ")
                ? authHeader.slice(7)
                : undefined);

        if (!accessToken) {
            throw new ApiError(401, "Unauthorized request");
        }

        const decodedToken = jwt.verify(accessToken, process.env.ACCESS_TOKEN_SECRET);
        const user = await User.findById(decodedToken?._id).select("-password -refreshToken");

        if (!user) {
            throw new ApiError(401, "Invalid access token");
        }

        req.user = user;
        next();
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid access token");
    }
});