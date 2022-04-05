const useAuth0 = jest.fn().mockReturnValue({
    getAccessTokenSilently: jest.fn(),
});

export { useAuth0 };
