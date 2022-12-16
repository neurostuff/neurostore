import { SnackbarKey, SnackbarProvider } from 'notistack';
import Navbar from './components/Navbar/Navbar';
import BaseNavigation from './pages/BaseNavigation/BaseNavigation';
import { useEffect, useRef } from 'react';
import API from './utils/api';
import useGetToken from './hooks/useGetToken';
import { IconButton } from '@mui/material';
import Close from '@mui/icons-material/Close';
import { TourProvider } from '@reactour/tour';
import { disableBodyScroll, enableBodyScroll } from 'body-scroll-lock';
import { QueryCache, QueryClient, QueryClientProvider } from 'react-query';
import { AxiosError } from 'axios';

const env = process.env.REACT_APP_ENV as 'DEV' | 'STAGING' | 'PROD';

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: env === 'DEV' ? 0 : 3, // need to do this because of issues testing with cypress
            refetchOnWindowFocus: env !== 'DEV', // need to do this because of issues testing with cypress
            refetchOnMount: false, // this is needed for smooth UI handling with the curation board
        },
    },
    queryCache: new QueryCache({
        onError: (error) => {
            const responseStatus = (error as AxiosError)?.response?.status;
            if (responseStatus && responseStatus === 404) {
                console.error('could not find resource');
            }
        },
    }),
});

function App() {
    const notistackRef = useRef<SnackbarProvider>(null);
    const token = useGetToken();

    useEffect(() => {
        API.UpdateServicesWithToken(token);
    }, [token]);

    const handleCloseSnackbar = (key: SnackbarKey) => (_event: React.MouseEvent) => {
        if (notistackRef?.current?.closeSnackbar) notistackRef.current?.closeSnackbar(key);
    };

    return (
        <QueryClientProvider client={queryClient}>
            <SnackbarProvider
                ref={notistackRef}
                autoHideDuration={5000}
                action={(key) => (
                    <IconButton onClick={handleCloseSnackbar(key)}>
                        <Close sx={{ color: 'white' }} />
                    </IconButton>
                )}
            >
                <TourProvider
                    steps={[]}
                    disableInteraction
                    afterOpen={(target) => {
                        if (target) disableBodyScroll(target);
                        sessionStorage.setItem('isTour', 'true');
                    }}
                    beforeClose={(target) => {
                        if (target) enableBodyScroll(target);
                        sessionStorage.setItem('isTour', 'false');
                    }}
                >
                    <Navbar />
                    <BaseNavigation />
                </TourProvider>
            </SnackbarProvider>
        </QueryClientProvider>
    );
}

export default App;
