const mockDeleteAnalysis = jest.fn().mockReturnValue({
    isLoading: false,
    mutate: jest.fn(),
});
export default mockDeleteAnalysis;
