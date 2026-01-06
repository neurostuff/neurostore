import { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import * as jose from 'jose';
import { enqueueSnackbar } from 'notistack';
import { _getAccessTokenSilentlyFunc, _updateServicesWithToken, axiosInstance } from './api.state';

// Extend Axios types to include our custom _retry property
export interface CustomAxiosRequestConfig extends InternalAxiosRequestConfig {
    _retry?: boolean;
}

const processQueue = (error: unknown, newToken: string | null = null) => {
    failedQueue.forEach((prom) => {
        if (error) {
            prom.reject(error);
        } else if (newToken) {
            prom.resolve(newToken);
        }
    });
    failedQueue = [];
};

const isTokenExpired = (token: string | undefined): boolean => {
    if (!token) return true;

    try {
        const decoded = jose.decodeJwt(token);

        // Check if exp claim exists
        if (!decoded.exp) return true;

        // Compare expiration time (in seconds) with current time
        // Add a 30 second buffer to refresh before actual expiration
        const currentTime = Math.floor(Date.now() / 1000);
        return decoded.exp < currentTime + 30;
    } catch (error) {
        // If we can't decode the token, consider it expired
        console.error('Error decoding JWT:', error);
        return true;
    }
};

export const handleResponse = (response: AxiosResponse) => {
    return response;
};

// Flag to prevent infinite retry loops
let isRefreshing = false;
let failedQueue: Array<{
    resolve: (token: string) => void;
    reject: (error: unknown) => void;
}> = [];
export const handleError = async (error: AxiosError) => {
    const originalRequest = error.config as CustomAxiosRequestConfig;

    const currentJWT = (originalRequest?.headers?.Authorization?.toString() ?? '').replace('Bearer ', '');

    if (!originalRequest || !currentJWT) {
        return Promise.reject(error);
    }

    const tokenExpired = isTokenExpired(currentJWT);
    if (error && tokenExpired && !originalRequest._retry) {
        if (isRefreshing) {
            // If already refreshing, queue this request
            // This promise will be resolved/rejected by processQueue() when the token refresh completes.
            // It keeps track of the original request via the function closure.
            return new Promise((resolve, reject) => {
                failedQueue.push({ resolve, reject });
            })
                .then((newToken) => {
                    originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
                    return axiosInstance(originalRequest);
                })
                .catch((err) => {
                    return Promise.reject(err);
                });
        }

        originalRequest._retry = true;
        isRefreshing = true;

        if (!_getAccessTokenSilentlyFunc) {
            processQueue(error, null);
            isRefreshing = false;
            return Promise.reject(error);
        }

        try {
            const newToken = await _getAccessTokenSilentlyFunc();
            _updateServicesWithToken(newToken);

            // Update the Authorization header for the failed request
            originalRequest.headers['Authorization'] = `Bearer ${newToken}`;

            processQueue(null, newToken);
            isRefreshing = false;

            // Retry the original request with the new token
            return axiosInstance(originalRequest);
        } catch (refreshError) {
            processQueue(refreshError, null);
            enqueueSnackbar('Your session has expired. Please log in again.', { variant: 'error' });
            isRefreshing = false;
            return Promise.reject(refreshError);
        }
    }

    return Promise.reject(error);
};

axiosInstance.interceptors.response.use(handleResponse, handleError);
