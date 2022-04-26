import { useAuth0 } from '@auth0/auth0-react';
import { useEffect, useState } from 'react';

const useGetToken = () => {
    const { getAccessTokenSilently, isAuthenticated } = useAuth0();
    const [token, setToken] = useState('');

    useEffect(() => {
        getAccessTokenSilently()
            .then((token) => {
                setToken(token);
            })
            .catch((err) => {
                // noop
            });
    }, [getAccessTokenSilently, isAuthenticated]);

    return token;
};

export default useGetToken;
