import { enqueueSnackbar } from 'notistack';
import { _getAccessTokenSilentlyFunc, _logoutFunc, axiosInstance } from './api.state';
import { OAuthError } from '@auth0/auth0-react';
import { clearUnloadHandlers } from 'helpers/BeforeUnload.helpers';

const env = import.meta.env.VITE_APP_ENV as 'DEV' | 'STAGING' | 'PROD';

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
            if (error instanceof OAuthError && error.error === 'login_required') {
                enqueueSnackbar('Your session has expired. You are now being logged out.', { variant: 'error' });
                setTimeout(() => {
                    if (_logoutFunc) {
                        clearUnloadHandlers();
                        _logoutFunc({ returnTo: window.location.origin });
                    }
                }, 2500);
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
