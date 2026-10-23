import ApiError from "../utils/ApiError.js";

export const validate = (schemas) => (req, res, next) => {
    for (const key of ["params", "body", "query"]) {
        const schema = schemas[key];
        if (!schema) continue;

        const result = schema.safeParse(req[key] ?? {});
        if (!result.success) {
            const errors = result.error.issues.map((i) => ({
                field: i.path.join("."),
                message: i.message,
            }));
            return next(new ApiError(400, errors[0]?.message || "Validation failed", errors));
        }
        if (key === "query") req.validatedQuery = result.data;
        else req[key] = result.data;
    }
    next();
};