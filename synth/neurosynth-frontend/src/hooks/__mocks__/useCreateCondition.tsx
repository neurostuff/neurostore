const useCreateConditions = jest.fn().mockReturnValue({
    mutate: jest.fn(),
    isLoading: false,
});

export default useCreateConditions;
