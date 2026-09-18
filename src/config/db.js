import mongoose from "mongoose";
import logger from "../utils/logger.js";

const connectDB = async () => {
    const connectionInstance = await mongoose.connect(
        `${process.env.MONGODB_URI}/${process.env.MONGODB_DB}`
    );
    logger.info(`MongoDB connected: ${connectionInstance.connection.host}`);
};

export default connectDB;