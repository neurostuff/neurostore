const useQueryClient = jest.fn().mockReturnValue({
    invalidateQueries: jest.fn(),
});

const useQuery = jest.fn().mockReturnValue({
    data: null,
    isLoading: false,
    isError: false,
});

export { useQueryClient, useQuery };
