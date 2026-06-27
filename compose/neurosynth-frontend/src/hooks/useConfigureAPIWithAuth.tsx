import { useAuth0 } from '@auth0/auth0-react';
import { useEffect } from 'react';
import { initAPISetAccessTokenFunc, initAPISetLogoutFunc } from 'api';

const useConfigureAPIWithAuth = () => {
    const { getAccessTokenSilently, logout, isAuthenticated, isLoading } = useAuth0();

    // Pass the getAccessTokenSilently function to use in a non react context (e.g. HTTP request interception)
    useEffect(() => {
        if (!isAuthenticated || isLoading) return;
        initAPISetAccessTokenFunc(getAccessTokenSilently);
        initAPISetLogoutFunc(logout);
    }, [getAccessTokenSilently, logout, isAuthenticated, isLoading]);
};

export default useConfigureAPIWithAuth;
