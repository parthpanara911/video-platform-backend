export const skipFor = (page, limit) => (page - 1) * limit;

export const buildPage = ({ docs, totalDocs, page, limit }) => {
    const totalPages = Math.ceil(totalDocs / limit) || 1;
    const hasPrevPage = page > 1;
    const hasNextPage = page < totalPages;
    return {
        docs,
        totalDocs,
        limit,
        page,
        totalPages,
        pagingCounter: skipFor(page, limit) + 1,
        hasPrevPage,
        hasNextPage,
        prevPage: hasPrevPage ? page - 1 : null,
        nextPage: hasNextPage ? page + 1 : null,
    };
};