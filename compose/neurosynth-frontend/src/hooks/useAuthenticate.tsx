import { useAuth0 } from '@auth0/auth0-react';
import { updateAPISetToken } from 'api';
import { useSnackbar } from 'notistack';
import { useNavigate } from 'react-router-dom';

const AUTH0_AUDIENCE = import.meta.env.VITE_APP_AUTH0_AUDIENCE;

function useAuthenticate() {
    const { enqueueSnackbar } = useSnackbar();
    const navigate = useNavigate();
    const { getAccessTokenWithPopup, logout } = useAuth0();

    const handleLogin = async () => {
        try {
            const token = await getAccessTokenWithPopup({
                audience: AUTH0_AUDIENCE,
                scope: 'openid profile email offline_access',
            });

            updateAPISetToken(token);

            if (window.gtag) {
                window.gtag('event', 'login');
            }

            navigate('/');
        } catch (error) {
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
