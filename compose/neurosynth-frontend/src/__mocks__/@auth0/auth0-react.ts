const useAuth0 = jest.fn().mockReturnValue({
    getAccessTokenSilently: jest.fn().mockImplementation(() => {
        return Promise.resolve('test-token');
    }),
    loginWithPopup: jest.fn(),
    logout: jest.fn(),
    isAuthenticated: false,
    isLoading: false,
    user: {
        sub: 'some-github-user',
    },
});

export { useAuth0 };
