const useDisplayWarnings = jest.fn().mockReturnValue({
    hasDuplicateName: false,
    hasNoName: false,
    hasNoPoints: false,
    hasNonMNICoordinates: false,
});

export default useDisplayWarnings;
