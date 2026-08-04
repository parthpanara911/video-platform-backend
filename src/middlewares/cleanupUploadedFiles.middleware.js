import fs from "fs";

const cleanupUploadedFiles = (req, res, next) => {
    let cleaned = false;

    const cleanup = () => {
        if (cleaned) return;
        cleaned = true;

        const files = [
            ...(req.file ? [req.file] : []),
            ...Object.values(req.files || {}).flat()
        ];

        files.forEach((file) => {
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