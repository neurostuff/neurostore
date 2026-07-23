import type { ReactNode } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import NeurosynthLoader from 'components/NeurosynthLoader/NeurosynthLoader';
import { Navigate, useLocation } from 'react-router-dom';

const ProtectedRoute = ({ errorMessage = '', children }: { errorMessage?: string; children?: ReactNode }) => {
    const { isAuthenticated, isLoading } = useAuth0();
    const { pathname } = useLocation();

    if (isLoading) {
        return <NeurosynthLoader loaded={false} />;
    }

    if (!isAuthenticated) {
        return (
            <Navigate
                to="/forbidden"
                replace
                state={{ errorMessage: errorMessage || `You do not have access to ${pathname}` }}
            />
        );
    }

    return <>{children}</>;
};

export default ProtectedRoute;
