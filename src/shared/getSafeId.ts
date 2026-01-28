export const getSafeId = (id: string | string[] | undefined): string => {
    if (!id) {
        throw new Error('ID is required');
    }

    return Array.isArray(id) ? id[0] : id;
};
