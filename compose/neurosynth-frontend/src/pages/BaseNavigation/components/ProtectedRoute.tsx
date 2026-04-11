import { useAuth0 } from '@auth0/auth0-react';
import NeurosynthLoader from 'components/NeurosynthLoader/NeurosynthLoader';
import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

const AUTH_SETTLE_DELAY_MS = 1500;

const ProtectedRoute: React.FC<{ errorMessage?: string }> = ({ errorMessage = '', children }) => {
    const { isAuthenticated, isLoading } = useAuth0();
    const { pathname } = useLocation();
    const [authSettled, setAuthSettled] = useState(false);

    useEffect(() => {
        if (isLoading || isAuthenticated) {
            setAuthSettled(false);
            return;
        }

        const timeoutId = window.setTimeout(() => {
            setAuthSettled(true);
        }, AUTH_SETTLE_DELAY_MS);

        return () => window.clearTimeout(timeoutId);
    }, [isAuthenticated, isLoading]);

    if (isLoading || (!isAuthenticated && !authSettled)) {
        return <NeurosynthLoader loaded={false} />;
    }

    if (!isAuthenticated) {
        return (
            <Navigate
                to="/forbidden"
                replace
                state={{
                    errorMessage: errorMessage || `You do not have access to ${pathname}`,
                    redirectOnAuth: pathname,
                }}
            />
        );
    }

    return <>{children}</>;
};

export default ProtectedRoute;
