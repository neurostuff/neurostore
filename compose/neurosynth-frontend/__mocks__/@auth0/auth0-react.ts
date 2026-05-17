import { vi } from 'vitest';

/**
 * Mirrors @auth0/auth0-react so instanceof checks in app code work when the module is mocked.
 * @see https://github.com/auth0/auth0-react/blob/master/src/errors.tsx
 */
export class OAuthError extends Error {
    constructor(public error: string, public error_description?: string) {
        super(error_description || error);
        Object.setPrototypeOf(this, OAuthError.prototype);
    }
}

const useAuth0 = vi.fn().mockReturnValue({
    getAccessTokenSilently: vi.fn().mockImplementation(() => {
        return Promise.resolve('test-token');
    }),
    getAccessTokenWithPopup: vi.fn(),
    logout: vi.fn(),
    isAuthenticated: false,
    isLoading: false,
    user: {
        sub: 'some-github-user',
    },
});

export { useAuth0 };
