import { vi } from 'vitest';

const useAuth0 = vi.fn().mockReturnValue({
    getAccessTokenSilently: vi.fn().mockImplementation(() => {
        return Promise.resolve('test-token');
    }),
    loginWithPopup: vi.fn(),
    logout: vi.fn(),
    isAuthenticated: false,
    isLoading: false,
    user: {
        sub: 'some-github-user',
    },
});

export { useAuth0 };
