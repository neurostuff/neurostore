const useSaveStudy = jest.fn().mockReturnValue({
    isLoading: false,
    hasEditse: false,
    handleSave: jest.fn(),
});

export default useSaveStudy;
