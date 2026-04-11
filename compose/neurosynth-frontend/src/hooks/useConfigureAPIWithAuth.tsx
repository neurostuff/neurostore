import { useAuth0 } from '@auth0/auth0-react';
import { useEffect } from 'react';
import { initAPISetAccessTokenFunc } from 'api';

type TokenOptions = {
    audience?: string;
    ignoreCache?: boolean;
};

const useConfigureAPIWithAuth = () => {
    const { getAccessTokenSilently, isAuthenticated, isLoading } = useAuth0();

    // Pass the getAccessTokenSilently function to use in a non react context (e.g. HTTP request interception)
    useEffect(() => {
        if (!isAuthenticated || isLoading) return;
        initAPISetAccessTokenFunc((audience?: string) => {
            const options: TokenOptions = {};
            if (audience) options.audience = audience;
            return getAccessTokenSilently(options);
        });
    }, [getAccessTokenSilently, isAuthenticated, isLoading]);
};

export default useConfigureAPIWithAuth;
