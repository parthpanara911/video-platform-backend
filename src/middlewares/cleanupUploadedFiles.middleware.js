import fs from "fs";

const cleanupUploadedFiles = (req, res, next) => {
    let cleaned = false;

    const cleanup = () => {
        if (!req.files || cleaned) return;
        cleaned = true;

        Object.values(req.files).flat().forEach(file => {
            if (file?.path && fs.existsSync(file.path)) {
                fs.unlinkSync(file.path);
            }
        });
    };

    res.once("finish", cleanup);
    res.once("close", cleanup);

    next();
};

export default cleanupUploadedFiles;