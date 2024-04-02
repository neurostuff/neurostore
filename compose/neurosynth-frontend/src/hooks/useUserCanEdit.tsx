import { useAuth0 } from '@auth0/auth0-react';
import { useMemo } from 'react';

const useUserCanEdit = (user: string | undefined) => {
    const { user: currentAuthenticatedUser, isAuthenticated } = useAuth0();
    return useMemo(() => {
        if (!isAuthenticated) return false;
        return (currentAuthenticatedUser?.sub || undefined) === (user || null);
    }, [currentAuthenticatedUser?.sub, isAuthenticated, user]);
};

export default useUserCanEdit;
