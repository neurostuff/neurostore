const useSaveStudy = jest.fn().mockReturnValue({
    isLoading: false,
    hasEdits: false,
    handleSave: jest.fn(),
});

export default useSaveStudy;
