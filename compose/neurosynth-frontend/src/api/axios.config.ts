import { enqueueSnackbar } from 'notistack';
import { _getAccessTokenSilentlyFunc, axiosInstance } from './api.state';

const env = import.meta.env.VITE_APP_ENV as 'DEV' | 'STAGING' | 'PROD';

axiosInstance.interceptors.request.use(
    async (config) => {
        if (!_getAccessTokenSilentlyFunc) throw new Error('Auth not initialized');
        const token = await _getAccessTokenSilentlyFunc();
        if (env === 'DEV' || env === 'STAGING') console.log(token);
        config.headers['Authorization'] = `Bearer ${token}`;
        return config;
    },
    (err) => {
        if (err?.response?.status === 403) {
            enqueueSnackbar('Your session has expired. Please log in again.', { variant: 'error' });
        }
        return Promise.reject(err);
    }
);
axiosInstance.interceptors.response.use(
    (res) => {
        return res;
    },
    (error) => {
        if (error?.response?.status === 403 || error?.error === 'login_required') {
            enqueueSnackbar('Your session has expired. Please log in again.', { variant: 'error' });
        }
        return Promise.reject(error);
    }
);
