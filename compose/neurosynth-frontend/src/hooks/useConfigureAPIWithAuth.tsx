import { useAuth0 } from '@auth0/auth0-react';
import { useEffect } from 'react';
import { initAPISetAccessTokenFunc } from 'api';

const useConfigureAPIWithAuth = () => {
    const { getAccessTokenSilently, isAuthenticated, isLoading } = useAuth0();

    // Pass the getAccessTokenSilently function to use in a non react context (e.g. HTTP request interception)
    useEffect(() => {
        if (!isAuthenticated || isLoading) return;
        initAPISetAccessTokenFunc(getAccessTokenSilently);
    }, [getAccessTokenSilently, isAuthenticated, isLoading]);
};

export default useConfigureAPIWithAuth;
