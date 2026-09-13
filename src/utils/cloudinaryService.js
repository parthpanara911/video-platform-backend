import cloudinary from "../config/cloudinary.js";

const uploadOnCloudinary = async (localFilePath) => {
    if (!localFilePath) return null;

    const response = await cloudinary.uploader.upload(localFilePath, {
        resource_type: "auto"
    });
    return response;
};

const deleteFromCloudinary = async (publicId, resourceType = "image") => {
    if (!publicId) return null;

    const response = await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType
    });
    return response;
};

export { uploadOnCloudinary, deleteFromCloudinary };