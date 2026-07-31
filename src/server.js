import dotenv from "dotenv";
import app from "./app.js";
import connectDB from "./db/connection.js";

dotenv.config();

const PORT = process.env.PORT || 4001;

connectDB()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        })
    })
    .catch((err) => {
        console.log("MONGODB connection failed:", err);
    });