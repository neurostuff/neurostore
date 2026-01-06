import { useAuth0 } from '@auth0/auth0-react';
import { useEffect } from 'react';
import { initAPISetAccessTokenFunc, updateAPISetToken } from 'api';
import { enqueueSnackbar } from 'notistack';

const useConfigureAPIWithAuth = () => {
    const { getAccessTokenSilently, isAuthenticated } = useAuth0();

    // Pass the getAccessTokenSilently function to use in a non react context (e.g. HTTP request interception)
    useEffect(() => {
        initAPISetAccessTokenFunc(getAccessTokenSilently);
    }, [getAccessTokenSilently]);

    // on window focus, we want to get the latest refresh token
    useEffect(() => {
        const onWindowFocus = async () => {
            if (!isAuthenticated) return;
            getAccessTokenSilently()
                .then((token) => {
                    updateAPISetToken(token);
                })
                .catch((error) => {
                    if (error.error && error.error === 'login_required') {
                        enqueueSnackbar('Your session has expired. Please log in again.', {
                            variant: 'error',
                        });
                    }
                });
        };

        window.addEventListener('focus', onWindowFocus);
        return () => {
            window.removeEventListener('focus', onWindowFocus);
        };
    }, [getAccessTokenSilently, isAuthenticated]);

    // on initial component mount, we want to get the latest refresh token
    useEffect(() => {
        if (!isAuthenticated) return;
        getAccessTokenSilently()
            .then((token) => {
                updateAPISetToken(token);
            })
            .catch((error) => {
                if (error.error && error.error === 'login_required') {
                    enqueueSnackbar('Your session has expired. Please log in again.', {
                        variant: 'error',
                    });
                }
            });
    }, [getAccessTokenSilently, isAuthenticated]);
};

export default useConfigureAPIWithAuth;
