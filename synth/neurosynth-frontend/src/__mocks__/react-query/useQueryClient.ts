const useQueryClient = jest.fn().mockReturnValue({
    invalidateQueries: jest.fn(),
});

export { useQueryClient };
