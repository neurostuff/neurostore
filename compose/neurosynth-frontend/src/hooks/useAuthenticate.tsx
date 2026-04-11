import { useAuth0 } from '@auth0/auth0-react';
import { initAPISetAccessTokenFunc } from 'api';
import { useSnackbar } from 'notistack';
import { useNavigate } from 'react-router-dom';

const AUTH0_AUDIENCE = import.meta.env.VITE_APP_AUTH0_AUDIENCE;

function useAuthenticate() {
    const { enqueueSnackbar } = useSnackbar();
    const navigate = useNavigate();
    const { getAccessTokenWithPopup, getAccessTokenSilently, logout } = useAuth0();

    const handleLogin = async () => {
        try {
            await getAccessTokenWithPopup({
                audience: AUTH0_AUDIENCE,
                scope: 'openid profile email offline_access',
            });

            initAPISetAccessTokenFunc(getAccessTokenSilently);

            if (window.gtag) {
                window.gtag('event', 'login');
            }

            navigate('/');
        } catch (error) {
            if (error instanceof Error && error.message === 'Popup closed') {
                console.error('Error getting token:', error.message);
                enqueueSnackbar(error.message, { variant: 'warning' });
                return;
            }
            console.error('Error getting token:', error);
            enqueueSnackbar('Error logging in', { variant: 'error' });
        }
    };

    const handleLogout = () => logout({ returnTo: window.location.origin });

    return {
        handleLogin,
        handleLogout,
    };
}

export default useAuthenticate;
