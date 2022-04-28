const useAuth0 = jest.fn().mockReturnValue({
    getAccessTokenSilently: jest.fn(),
    loginWithPopup: jest.fn(),
    logout: jest.fn(),
    isAuthenticated: false,
    user: {
        sub: 'some-github-user',
    },
});

export { useAuth0 };
