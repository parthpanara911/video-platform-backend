import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";
import asyncHandler from "../utils/asyncHandler.js";

export const optionalAuth = asyncHandler(async (req, res, next) => {
    const authHeader = req.header("Authorization");
    const accessToken = req.cookies?.accessToken ||
        (authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined);

    if (!accessToken) {
        return next();
    }

    try {
        const decodedToken = jwt.verify(accessToken, process.env.ACCESS_TOKEN_SECRET);
        const user = await User.findById(decodedToken?._id).select("-password -refreshToken");
        if (user) req.user = user;
    } catch (error) {
        // treat as anonymous
    }

    next();
});