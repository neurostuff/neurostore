import { useAuth0 } from '@auth0/auth0-react';
import { useEffect } from 'react';
import API from 'utils/api';

const useGetToken = () => {
    const { getAccessTokenSilently, isAuthenticated } = useAuth0();
    useEffect(() => {
        getAccessTokenSilently()
            .then((token) => {
                API.UpdateServicesWithToken(token);
            })
            .catch((err) => {
                // noop
            });
    }, [getAccessTokenSilently, isAuthenticated]);
};

export default useGetToken;
