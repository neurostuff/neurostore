import Close from '@mui/icons-material/Close';
import { IconButton } from '@mui/material';
import { AxiosError } from 'axios';
import useGoogleAnalytics from 'hooks/useGoogleAnalytics';
import { SnackbarKey, SnackbarProvider } from 'notistack';
import { useEffect, useRef } from 'react';
import { QueryCache, QueryClient, QueryClientProvider } from 'react-query';
import Navbar from './components/Navbar/Navbar';
import useGetToken from './hooks/useGetToken';
import BaseNavigation from './pages/BaseNavigation/BaseNavigation';
import { useLocation } from 'react-router-dom';
import Downbanner from 'components/Downbanner';

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: 0,
            // staleTime: 5000, // https://tkdodo.eu/blog/practical-react-query#the-defaults-explained
        },
    },
    queryCache: new QueryCache({
        onError: (error) => {
            console.log({ error });
            const responseStatus = (error as AxiosError)?.response?.status;
            if (responseStatus && responseStatus === 404) {
                console.error('could not find resource');
            }
        },
    }),
});

declare global {
    interface Window {
        gtag?: (
            type: 'event' | 'config' | 'get' | 'set' | 'consent',
            action: 'login' | 'page_view',
            options?: any
        ) => void;
    }
}

function App() {
    const notistackRef = useRef<SnackbarProvider>(null);
    useGetToken();
    useGoogleAnalytics();

    const location = useLocation();
    useEffect(() => {
        if (window.gtag) {
            window.gtag('event', 'page_view', {
                page_path: `${location.pathname}${location.search}`,
            });
        }
    }, [location]);

    const handleCloseSnackbar = (key: SnackbarKey) => (_event: React.MouseEvent) => {
        if (notistackRef?.current?.closeSnackbar) notistackRef.current?.closeSnackbar(key);
    };

    return (
        <QueryClientProvider client={queryClient}>
            <SnackbarProvider
                ref={notistackRef}
                autoHideDuration={8000}
                action={(key) => (
                    <IconButton onClick={handleCloseSnackbar(key)}>
                        <Close sx={{ color: 'white' }} />
                    </IconButton>
                )}
            >
                <Downbanner />
                <Navbar />
                <BaseNavigation />
            </SnackbarProvider>
        </QueryClientProvider>
    );
}

export default App;
