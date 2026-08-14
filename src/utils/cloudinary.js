import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const uploadOnCloudinary = async (localFilePath) => {
    if (!localFilePath) return null;

    const response = await cloudinary.uploader.upload(localFilePath, {
        resource_type: "auto"
    });
    // console.log("File is uploaded on cloudinary", response);
    return response;
};

const deleteFromCloudinary = async (publicId, resourceType = "image") => {
    if (!publicId) return null;

    const response = await cloudinary.uploader.destroy(publicId, {
        resource_Type: resourceType
    });

    return response;
};

export { uploadOnCloudinary, deleteFromCloudinary };