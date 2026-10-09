import { enqueueSnackbar } from 'notistack';
import { _getAccessTokenSilentlyFunc, _logoutFunc, axiosInstance } from './api.state';
import { clearUnloadHandlers } from 'helpers/BeforeUnload.helpers';

const env = import.meta.env.VITE_APP_ENV as 'DEV' | 'STAGING' | 'PROD';
const AUTH_ERROR_CODES_REQUIRING_LOGOUT = ['login_required', 'missing_refresh_token', 'invalid_grant'];
let isSessionLogoutPending = false;

const logoutExpiredSession = () => {
    const logout = _logoutFunc;
    if (isSessionLogoutPending || !logout) return;

    isSessionLogoutPending = true;
    enqueueSnackbar('Your session has expired. You are now being logged out.', { variant: 'error' });
    setTimeout(() => {
        clearUnloadHandlers();
        logout({
            logoutParams: {
                returnTo: window.location.origin,
            },
        });
    }, 2500);
};

axiosInstance.interceptors.request.use(
    async (config) => {
        try {
            if (!_getAccessTokenSilentlyFunc) {
                console.warn('Auth not initialized');
            } else {
                const token = await _getAccessTokenSilentlyFunc();
                if (env === 'DEV' || env === 'STAGING') console.log(token);
                config.headers['Authorization'] = `Bearer ${token}`;
            }
            return config;
        } catch (error) {
            const authErrorCode =
                typeof error === 'object' && error !== null && 'error' in error ? error.error : undefined;
            if (typeof authErrorCode === 'string' && AUTH_ERROR_CODES_REQUIRING_LOGOUT.includes(authErrorCode)) {
                logoutExpiredSession();
            }
            throw new Error('Error getting access token', { cause: error });
        }
    },
    (err) => {
        return Promise.reject(err);
    }
);
axiosInstance.interceptors.response.use(
    (res) => res,
    (error) => {
        if (error?.response?.status === 403) {
            enqueueSnackbar('You do not have permission to perform this action.', { variant: 'error' });
        }
        return Promise.reject(error);
    }
);
