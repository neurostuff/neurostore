import { OAuthError, useAuth0 } from '@auth0/auth0-react';
import { initAPISetAccessTokenFunc } from 'api';
import { useSnackbar } from 'notistack';
import { useNavigate } from 'react-router-dom';

const AUTH0_AUDIENCE = import.meta.env.VITE_APP_AUTH0_AUDIENCE;

/** When set, the next popup uses prompt=login so Universal Login restarts (e.g. pick another IdP after closing on consent). */
const AUTH0_FORCE_PROMPT_LOGIN_KEY = 'neurosynth_auth0_force_prompt_login';

function isAuth0AccessDenied(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) return false;
    return error instanceof OAuthError && error.error === 'access_denied';
}

function isAuth0PopupClosed(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) return false;
    return error instanceof OAuthError && error.error === 'cancelled';
}

function useAuthenticate() {
    const { enqueueSnackbar } = useSnackbar();
    const navigate = useNavigate();
    const { getAccessTokenWithPopup, getAccessTokenSilently, logout } = useAuth0();

    const handleLogin = async () => {
        const forcePromptLogin = sessionStorage.getItem(AUTH0_FORCE_PROMPT_LOGIN_KEY) === '1';

        try {
            await getAccessTokenWithPopup({
                audience: AUTH0_AUDIENCE,
                scope: 'openid profile email offline_access',
                ...(forcePromptLogin ? { prompt: 'login' as const } : {}),
            });

            sessionStorage.removeItem(AUTH0_FORCE_PROMPT_LOGIN_KEY);

            initAPISetAccessTokenFunc(getAccessTokenSilently);

            if (window.gtag) {
                window.gtag('event', 'login');
            }

            navigate('/');
        } catch (error) {
            if (isAuth0PopupClosed(error) || isAuth0AccessDenied(error)) {
                sessionStorage.setItem(AUTH0_FORCE_PROMPT_LOGIN_KEY, '1');
            }

            if (isAuth0AccessDenied(error)) {
                enqueueSnackbar('Sign in/Sign up cancelled', { variant: 'warning' });
                return;
            } else if (!isAuth0PopupClosed(error)) {
                enqueueSnackbar('Sign in/Sign up Error', { variant: 'error' });
                return;
            }
        }
    };

    const handleLogout = () => logout({ returnTo: window.location.origin });

    return {
        handleLogin,
        handleLogout,
    };
}

export default useAuthenticate;
