const useHistory = jest.fn().mockReturnValue({
    push: jest.fn(),
});

export { useHistory };
