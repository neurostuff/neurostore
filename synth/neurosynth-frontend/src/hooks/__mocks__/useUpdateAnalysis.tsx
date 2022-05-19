const mockUpdateAnalysis = jest.fn().mockReturnValue({
    isLoading: false,
    isError: false,
    mutate: jest.fn(),
});
export default mockUpdateAnalysis;
