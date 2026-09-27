import { parse } from "basic-auth";

export const bullBoardAuth = (req, res, next) => {
    const adminUser = process.env.BULL_BOARD_USER;
    const adminPassword = process.env.BULL_BOARD_PASSWORD;

    if (!adminUser || !adminPassword) {
        return res.status(503).json({
            success: false,
            message: "Bull Board is not configured. Set BULL_BOARD_USER and BULL_BOARD_PASSWORD.",
        });
    }

    const credentials = parse(req.headers.authorization || "");

    const isValid =
        credentials &&
        credentials.name === adminUser &&
        credentials.pass === adminPassword;

    if (!isValid) {
        res.set("WWW-Authenticate", 'Basic realm="VideoStream Admin"');
        return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    next();
};