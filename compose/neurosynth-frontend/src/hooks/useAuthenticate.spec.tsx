import { OAuthError, useAuth0 } from '@auth0/auth0-react';
import { initAPISetAccessTokenFunc } from 'api';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useSnackbar } from 'notistack';
import { useNavigate } from 'react-router-dom';
import { vi, type Mock } from 'vitest';
import useAuthenticate from './useAuthenticate';

/** Must match `AUTH0_FORCE_PROMPT_LOGIN_KEY` in useAuthenticate.tsx */
const AUTH0_FORCE_PROMPT_LOGIN_KEY = 'neurosynth_auth0_force_prompt_login';

vi.mock('@auth0/auth0-react');
vi.mock('notistack');
vi.mock('react-router-dom');
vi.mock('api');

const enqueueSnackbarMock = () => (useSnackbar() as unknown as { enqueueSnackbar: Mock }).enqueueSnackbar;

const LoginHarness = () => {
    const { handleLogin, handleLogout } = useAuthenticate();
    return (
        <div>
            <button type="button" data-testid="login" onClick={() => void handleLogin()}>
                login
            </button>
            <button type="button" data-testid="logout" onClick={() => handleLogout()}>
                logout
            </button>
        </div>
    );
};

describe('useAuthenticate', () => {
    const expectedAudience = import.meta.env.VITE_APP_AUTH0_AUDIENCE;

    beforeEach(() => {
        vi.clearAllMocks();
        sessionStorage.clear();
        delete (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
    });

    describe('handleLogin', () => {
        it('calls Auth0 popup with audience and scope, wires API token helper, navigates home, and clears force-login flag on success', async () => {
            sessionStorage.setItem(AUTH0_FORCE_PROMPT_LOGIN_KEY, '1');
            (useAuth0().getAccessTokenWithPopup as Mock).mockResolvedValue('token');

            render(<LoginHarness />);

            await act(async () => {
                userEvent.click(screen.getByTestId('login'));
            });

            expect(sessionStorage.getItem(AUTH0_FORCE_PROMPT_LOGIN_KEY)).toBeNull();
            expect(useAuth0().getAccessTokenWithPopup as Mock).toHaveBeenCalledWith({
                audience: expectedAudience,
                scope: 'openid profile email offline_access',
                prompt: 'login',
            });
            expect(initAPISetAccessTokenFunc).toHaveBeenCalledWith(useAuth0().getAccessTokenSilently as Mock);
            expect(useNavigate() as Mock).toHaveBeenCalledWith('/');
            expect(enqueueSnackbarMock()).not.toHaveBeenCalled();
        });

        it('does not pass prompt=login when session flag is absent', async () => {
            (useAuth0().getAccessTokenWithPopup as Mock).mockResolvedValue('token');

            render(<LoginHarness />);

            await act(async () => {
                userEvent.click(screen.getByTestId('login'));
            });

            expect(useAuth0().getAccessTokenWithPopup as Mock).toHaveBeenCalledWith({
                audience: expectedAudience,
                scope: 'openid profile email offline_access',
            });
        });

        it('fires gtag login event when window.gtag exists', async () => {
            const gtag = vi.fn();
            (window as unknown as { gtag: typeof gtag }).gtag = gtag;
            (useAuth0().getAccessTokenWithPopup as Mock).mockResolvedValue('token');

            render(<LoginHarness />);

            await act(async () => {
                userEvent.click(screen.getByTestId('login'));
            });

            expect(gtag).toHaveBeenCalledWith('event', 'login');
        });

        it('sets session flag and warning snackbar on access_denied (OAuthError)', async () => {
            (useAuth0().getAccessTokenWithPopup as Mock).mockRejectedValue(
                new OAuthError('access_denied', 'user denied')
            );

            render(<LoginHarness />);

            await act(async () => {
                userEvent.click(screen.getByTestId('login'));
            });

            expect(sessionStorage.getItem(AUTH0_FORCE_PROMPT_LOGIN_KEY)).toBe('1');
            expect(enqueueSnackbarMock()).toHaveBeenCalledWith('Sign in/Sign up cancelled', { variant: 'warning' });
            expect(useNavigate() as Mock).not.toHaveBeenCalled();
            expect(initAPISetAccessTokenFunc).not.toHaveBeenCalled();
        });

        it('sets session flag and no snackbar on popup cancelled (OAuthError cancelled)', async () => {
            (useAuth0().getAccessTokenWithPopup as Mock).mockRejectedValue(new OAuthError('cancelled', 'popup closed'));

            render(<LoginHarness />);

            await act(async () => {
                userEvent.click(screen.getByTestId('login'));
            });

            expect(sessionStorage.getItem(AUTH0_FORCE_PROMPT_LOGIN_KEY)).toBe('1');
            expect(enqueueSnackbarMock()).not.toHaveBeenCalled();
            expect(useNavigate() as Mock).not.toHaveBeenCalled();
        });

        it('does not set session flag on generic Error (e.g. legacy Popup closed message)', async () => {
            (useAuth0().getAccessTokenWithPopup as Mock).mockRejectedValue(new Error('Popup closed'));

            render(<LoginHarness />);

            await act(async () => {
                userEvent.click(screen.getByTestId('login'));
            });

            expect(sessionStorage.getItem(AUTH0_FORCE_PROMPT_LOGIN_KEY)).toBeNull();
            expect(enqueueSnackbarMock()).toHaveBeenCalledWith('Sign in/Sign up Error', { variant: 'error' });
        });

        it('does not set session flag on OAuthError other than access_denied or cancelled', async () => {
            (useAuth0().getAccessTokenWithPopup as Mock).mockRejectedValue(
                new OAuthError('login_required', 'silent auth failed')
            );

            render(<LoginHarness />);

            await act(async () => {
                userEvent.click(screen.getByTestId('login'));
            });

            expect(sessionStorage.getItem(AUTH0_FORCE_PROMPT_LOGIN_KEY)).toBeNull();
            expect(enqueueSnackbarMock()).toHaveBeenCalledWith('Sign in/Sign up Error', { variant: 'error' });
        });

        it('does not set session flag on non-OAuth thrown value', async () => {
            (useAuth0().getAccessTokenWithPopup as Mock).mockRejectedValue('string failure');

            render(<LoginHarness />);

            await act(async () => {
                userEvent.click(screen.getByTestId('login'));
            });

            expect(sessionStorage.getItem(AUTH0_FORCE_PROMPT_LOGIN_KEY)).toBeNull();
            expect(enqueueSnackbarMock()).toHaveBeenCalledWith('Sign in/Sign up Error', { variant: 'error' });
        });

        it('forces login after access_denied sending prompt=login', async () => {
            (useAuth0().getAccessTokenWithPopup as Mock)
                .mockRejectedValueOnce(new OAuthError('access_denied', 'denied'))
                .mockResolvedValueOnce('token');

            render(<LoginHarness />);

            await act(async () => {
                userEvent.click(screen.getByTestId('login'));
            });
            expect(sessionStorage.getItem(AUTH0_FORCE_PROMPT_LOGIN_KEY)).toBe('1');

            await act(async () => {
                userEvent.click(screen.getByTestId('login'));
            });

            expect(useAuth0().getAccessTokenWithPopup as Mock).toHaveBeenNthCalledWith(2, {
                audience: expectedAudience,
                scope: 'openid profile email offline_access',
                prompt: 'login',
            });
            expect(sessionStorage.getItem(AUTH0_FORCE_PROMPT_LOGIN_KEY)).toBeNull();
            expect(useNavigate() as Mock).toHaveBeenCalledWith('/');
        });
    });

    describe('handleLogout', () => {
        it('calls Auth0 logout with returnTo origin', () => {
            render(<LoginHarness />);

            userEvent.click(screen.getByTestId('logout'));

            expect(useAuth0().logout as Mock).toHaveBeenCalledWith({ returnTo: window.location.origin });
        });
    });

    describe('useAuth0 wiring', () => {
        it('reads auth helpers from useAuth0', () => {
            render(<LoginHarness />);
            expect(useAuth0).toHaveBeenCalled();
            expect(useSnackbar).toHaveBeenCalled();
            expect(useNavigate).toHaveBeenCalled();
        });
    });
});
