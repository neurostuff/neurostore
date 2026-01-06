/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Tests for axios.config.ts
 *
 * This test suite covers the error handling and token refresh logic for API requests.
 *
 * Test Coverage:
 * - handleResponse: Simple response pass-through
 * - handleError: Token refresh and retry logic
 *   - Basic error cases (no config, no token, valid token, already retried)
 *   - Token refresh success scenario
 *   - Token refresh failure scenario
 *   - Request queueing during token refresh (prevents race conditions)
 *   - Edge cases (missing exp claim, invalid JWT, soon-to-expire tokens)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AxiosError, AxiosHeaders, AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import * as jose from 'jose';
// Import after mocking
import * as apiState from './api.state';
import { CustomAxiosRequestConfig, handleError, handleResponse } from './axios.config';

vi.mock('notistack');
vi.mock('jose');

// Mock api.state module - need to provide inline mock
vi.mock('./api.state', () => {
    const mockAxiosInstanceFn = vi.fn();
    (mockAxiosInstanceFn as unknown as AxiosInstance).interceptors = {
        request: {
            use: vi.fn() as any,
            eject: vi.fn() as any,
            clear: vi.fn() as any,
        },
        response: {
            use: vi.fn() as any,
            eject: vi.fn() as any,
            clear: vi.fn() as any,
        },
    };

    return {
        axiosInstance: mockAxiosInstanceFn,
        _getAccessTokenSilentlyFunc: null,
        neurostoreConfig: { accessToken: '' },
        neurosynthConfig: { accessToken: '' },
        _setAccessTokenSilentlyFunc: vi.fn(),
        _updateServicesWithToken: vi.fn(),
        _setEnqueueSnackbarFunc: vi.fn(),
        _enqueueSnackbarFunc: vi.fn(),
    };
});

describe('axios.config', () => {
    let mockAxiosInstance: ReturnType<typeof vi.fn>;
    let mockGetAccessTokenSilently: ReturnType<typeof vi.fn>;
    let mockUpdateServicesWithToken: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockGetAccessTokenSilently = vi.fn();
        mockUpdateServicesWithToken = vi.fn();
        // Get reference to the mocked axios instance

        mockAxiosInstance = apiState.axiosInstance as any;

        // Reset api.state mocks

        (apiState as any)._getAccessTokenSilentlyFunc = null;

        (apiState as any).neurostoreConfig = { accessToken: '' };

        (apiState as any).neurosynthConfig = { accessToken: '' };
    });

    afterEach(() => {
        vi.clearAllTimers();
    });

    describe('handleResponse', () => {
        it('should return the response unchanged', () => {
            const mockResponse: AxiosResponse = {
                data: { test: 'data' },
                status: 200,
                statusText: 'OK',
                headers: {},
                config: {} as InternalAxiosRequestConfig,
            };

            const result = handleResponse(mockResponse);
            expect(result).toBe(mockResponse);
        });
    });

    describe('handleError', () => {
        const createMockError = (
            status: number = 500,
            token: string = 'valid.token.here',
            retry: boolean = false
        ): AxiosError => {
            const config: CustomAxiosRequestConfig = {
                headers: new AxiosHeaders({
                    Authorization: `Bearer ${token}`,
                }),
                _retry: retry,
            } as any;

            return {
                config,
                response: {
                    status,
                    data: {},
                    statusText: 'Unauthorized',
                    headers: {},
                    config,
                },
                isAxiosError: true,
                toJSON: () => ({}),
                name: 'AxiosError',
                message: 'Request failed',
            } as AxiosError;
        };

        const createExpiredToken = () => {
            const pastTime = Math.floor(Date.now() / 1000) - 100; // expired 100 seconds ago
            return { exp: pastTime };
        };

        const createValidToken = () => {
            const futureTime = Math.floor(Date.now() / 1000) + 3600; // expires in 1 hour
            return { exp: futureTime };
        };

        it('should reject if there is no config', async () => {
            const error: AxiosError = {
                config: undefined,
                isAxiosError: true,
                toJSON: () => ({}),
                name: 'AxiosError',
                message: 'Request failed',
            } as AxiosError;

            await expect(handleError(error)).rejects.toBe(error);
        });

        it('should reject if there is no JWT token in headers', async () => {
            const error: AxiosError = {
                config: {
                    headers: new AxiosHeaders({}),
                } as InternalAxiosRequestConfig,
                response: {
                    status: 500,
                } as any,
                isAxiosError: true,
                toJSON: () => ({}),
                name: 'AxiosError',
                message: 'Request failed',
            } as AxiosError;

            await expect(handleError(error)).rejects.toBe(error);
        });

        it('should reject if token is not expired and pass through the original error', async () => {
            const mockJwtDecode = vi.mocked(jose.decodeJwt);
            mockJwtDecode.mockReturnValue(createValidToken());

            const error = createMockError(500, 'valid.token.here');

            await expect(handleError(error)).rejects.toBe(error);
            expect(mockJwtDecode).toHaveBeenCalledWith('valid.token.here');
        });

        it('should reject if request was already retried', async () => {
            const mockJwtDecode = vi.mocked(jose.decodeJwt);
            mockJwtDecode.mockReturnValue(createExpiredToken());

            const error = createMockError(500, 'expired.token.here', true);

            await expect(handleError(error)).rejects.toBe(error);
        });

        it('should reject if getAccessTokenSilentlyFunc is not set', async () => {
            const mockJwtDecode = vi.mocked(jose.decodeJwt);
            mockJwtDecode.mockReturnValue(createExpiredToken());

            const error = createMockError(500, 'expired.token.here');

            (apiState as any)._getAccessTokenSilentlyFunc = null;

            await expect(handleError(error)).rejects.toBe(error);
        });

        it('should refresh token and retry request with expired token', async () => {
            const mockJwtDecode = vi.mocked(jose.decodeJwt);
            mockJwtDecode.mockReturnValue(createExpiredToken());

            const newToken = 'new.fresh.token';
            mockGetAccessTokenSilently.mockResolvedValue(newToken);

            (apiState as any)._getAccessTokenSilentlyFunc = mockGetAccessTokenSilently;
            (apiState as any)._updateServicesWithToken = mockUpdateServicesWithToken;

            const mockRetryResponse: AxiosResponse = {
                data: { success: true },
                status: 200,
                statusText: 'OK',
                headers: {},
                config: {} as InternalAxiosRequestConfig,
            };
            mockAxiosInstance.mockResolvedValue(mockRetryResponse);

            const error = createMockError(500, 'expired.token.here');
            const result = await handleError(error);

            expect(mockGetAccessTokenSilently).toHaveBeenCalled();
            expect(mockUpdateServicesWithToken).toHaveBeenCalledWith(newToken);
            expect(error.config?.headers?.['Authorization']).toBe(`Bearer ${newToken}`);
            expect(mockAxiosInstance).toHaveBeenCalledWith(error.config);
            expect(result).toBe(mockRetryResponse);
        });

        it('should reject if token refresh fails', async () => {
            const mockJwtDecode = vi.mocked(jose.decodeJwt);
            mockJwtDecode.mockReturnValue(createExpiredToken());

            const refreshError = new Error('Token refresh failed');
            mockGetAccessTokenSilently.mockRejectedValue(refreshError);

            (apiState as any)._getAccessTokenSilentlyFunc = mockGetAccessTokenSilently;

            const error = createMockError(500, 'expired.token.here');

            await expect(handleError(error)).rejects.toBe(refreshError);
            expect(mockGetAccessTokenSilently).toHaveBeenCalled();
            expect(mockAxiosInstance).not.toHaveBeenCalled();
        });

        it('should queue multiple requests while token is refreshing', async () => {
            const mockJwtDecode = vi.mocked(jose.decodeJwt);
            mockJwtDecode.mockReturnValue(createExpiredToken());

            const newToken = 'new.fresh.token';
            let resolveTokenRefresh: (value: string) => void;
            mockGetAccessTokenSilently.mockReturnValue(
                new Promise<string>((resolve) => {
                    resolveTokenRefresh = resolve;
                })
            );

            (apiState as any)._getAccessTokenSilentlyFunc = mockGetAccessTokenSilently;

            const mockRetryResponse1: AxiosResponse = {
                data: { request: 1 },
                status: 200,
                statusText: 'OK',
                headers: {},
                config: {} as InternalAxiosRequestConfig,
            };
            const mockRetryResponse2: AxiosResponse = {
                data: { request: 2 },
                status: 200,
                statusText: 'OK',
                headers: {},
                config: {} as InternalAxiosRequestConfig,
            };
            mockAxiosInstance.mockResolvedValueOnce(mockRetryResponse1).mockResolvedValueOnce(mockRetryResponse2);

            const error1 = createMockError(500, 'expired.token.here');
            const error2 = createMockError(500, 'expired.token.here');

            // Start both requests
            const promise1 = handleError(error1);
            const promise2 = handleError(error2);

            // Resolve the token refresh
            resolveTokenRefresh!(newToken);

            // Wait for both to complete
            const [result1, result2] = await Promise.all([promise1, promise2]);

            // Both should have succeeded
            expect(result1).toBe(mockRetryResponse1);
            expect(result2).toBe(mockRetryResponse2);

            // Token refresh should only be called once
            expect(mockGetAccessTokenSilently).toHaveBeenCalledTimes(1);

            // Both requests should have been retried with new token
            expect(mockAxiosInstance).toHaveBeenCalledTimes(2);
            expect(error1.config?.headers?.['Authorization']).toBe(`Bearer ${newToken}`);
            expect(error2.config?.headers?.['Authorization']).toBe(`Bearer ${newToken}`);
        });

        it('should reject queued requests if token refresh fails', async () => {
            const mockJwtDecode = vi.mocked(jose.decodeJwt);
            mockJwtDecode.mockReturnValue(createExpiredToken());

            const refreshError = new Error('Token refresh failed');
            let rejectTokenRefresh: (error: Error) => void;
            const tokenRefreshPromise = new Promise<string>((_, reject) => {
                rejectTokenRefresh = reject;
            });
            mockGetAccessTokenSilently.mockReturnValue(tokenRefreshPromise);

            (apiState as any)._getAccessTokenSilentlyFunc = mockGetAccessTokenSilently;

            const error1 = createMockError(500, 'expired.token.here');
            const error2 = createMockError(500, 'expired.token.here');

            // Start both requests
            const promise1 = handleError(error1);
            const promise2 = handleError(error2);

            // Reject the token refresh
            rejectTokenRefresh!(refreshError);

            // Both should be rejected
            await expect(promise1).rejects.toBe(refreshError);
            await expect(promise2).rejects.toBe(refreshError);

            // Token refresh should only be called once
            expect(mockGetAccessTokenSilently).toHaveBeenCalledTimes(1);

            // No requests should have been retried
            expect(mockAxiosInstance).not.toHaveBeenCalled();
        });

        it('should handle token without exp claim', async () => {
            const mockJwtDecode = vi.mocked(jose.decodeJwt);
            mockJwtDecode.mockReturnValue({}); // No exp claim

            const error = createMockError(500, 'token.without.exp');

            (apiState as any)._getAccessTokenSilentlyFunc = null;

            await expect(handleError(error)).rejects.toBe(error);
        });

        it('should handle invalid JWT token', async () => {
            const mockJwtDecode = vi.mocked(jose.decodeJwt);
            mockJwtDecode.mockImplementation(() => {
                throw new Error('Invalid token');
            });

            const error = createMockError(500, 'invalid.token');

            (apiState as any)._getAccessTokenSilentlyFunc = null;

            await expect(handleError(error)).rejects.toBe(error);
        });

        it('should consider token expired if expiring within 30 seconds', async () => {
            const mockJwtDecode = vi.mocked(jose.decodeJwt);
            const soonToExpireTime = Math.floor(Date.now() / 1000) + 20; // expires in 20 seconds
            mockJwtDecode.mockReturnValue({ exp: soonToExpireTime });

            const newToken = 'new.fresh.token';
            mockGetAccessTokenSilently.mockResolvedValue(newToken);

            (apiState as any)._getAccessTokenSilentlyFunc = mockGetAccessTokenSilently;

            const mockRetryResponse: AxiosResponse = {
                data: { success: true },
                status: 200,
                statusText: 'OK',
                headers: {},
                config: {} as InternalAxiosRequestConfig,
            };
            mockAxiosInstance.mockResolvedValue(mockRetryResponse);

            const error = createMockError(500, 'soon.to.expire.token');
            const result = await handleError(error);

            // Should have refreshed the token
            expect(mockGetAccessTokenSilently).toHaveBeenCalled();
            expect(result).toBe(mockRetryResponse);
        });

        it('should reject errors with other status codes even with expired token', async () => {
            const mockJwtDecode = vi.mocked(jose.decodeJwt);
            mockJwtDecode.mockReturnValue(createExpiredToken());

            const error = createMockError(403, 'expired.token.here'); // 500 error

            await expect(handleError(error)).rejects.toBe(error);
        });
    });
});
