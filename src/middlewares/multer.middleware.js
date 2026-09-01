import multer from "multer";

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './public/temp');
    },
    filename: function (req, file, cb) {
        const uniqueName = Date.now() + '-' + file.originalname;
        cb(null, uniqueName);
    }
});

export const uploadVideoAssets = multer({
    storage,
    limits: { fileSize: 200 * 1024 * 1024 },
});

export const uploadThumbnailOnly = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
});