import mongoose from "mongoose";

export const toObjectId = (value) =>
    value instanceof mongoose.Types.ObjectId ? value : new mongoose.Types.ObjectId(String(value));

export const sameId = (a, b) => String(a) === String(b);