import { vi, type Mock } from 'vitest';

vi.mock('notistack');
vi.mock('helpers/BeforeUnload.helpers', () => ({
    clearUnloadHandlers: vi.fn(),
}));

const configureInterceptors = async (getAccessTokenSilently: () => Promise<string>) => {
    const { axiosInstance, _setAccessTokenSilentlyFunc, _setLogoutFunc } = await import('./api.state');
    const logout = vi.fn();

    _setAccessTokenSilentlyFunc(getAccessTokenSilently);
    _setLogoutFunc(logout);
    await import('./axios.config');

    const { enqueueSnackbar } = await import('notistack');
    const { clearUnloadHandlers } = await import('helpers/BeforeUnload.helpers');
    return {
        axiosInstance,
        clearUnloadHandlers: clearUnloadHandlers as Mock,
        enqueueSnackbar: enqueueSnackbar as Mock,
        logout,
    };
};

describe('axios auth interceptors', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it.each(['login_required', 'missing_refresh_token', 'invalid_grant'])(
        'logs out when token renewal fails with %s',
        async (authErrorCode) => {
            const authError = { error: authErrorCode };
            const { axiosInstance, clearUnloadHandlers, enqueueSnackbar, logout } = await configureInterceptors(
                vi.fn().mockRejectedValue(authError)
            );

            await expect(axiosInstance.get('/test')).rejects.toEqual(
                new Error('Error getting access token', { cause: authError })
            );
            expect(enqueueSnackbar).toHaveBeenCalledOnce();

            await vi.advanceTimersByTimeAsync(2500);

            expect(clearUnloadHandlers).toHaveBeenCalledOnce();
            expect(logout).toHaveBeenCalledWith({
                logoutParams: {
                    returnTo: window.location.origin,
                },
            });
        }
    );
});
