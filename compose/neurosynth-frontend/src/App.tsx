import { SnackbarKey, SnackbarProvider } from 'notistack';
import Navbar from './components/Navbar/Navbar';
import BaseNavigation from './pages/BaseNavigation/BaseNavigation';
import { BrowserRouter } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import API from './utils/api';
import useGetToken from './hooks/useGetToken';
import { Grow, IconButton } from '@mui/material';
import Close from '@mui/icons-material/Close';
import { TourProvider, useTour } from '@reactour/tour';
import { disableBodyScroll, enableBodyScroll } from 'body-scroll-lock';

function App() {
    const notistackRef = useRef<SnackbarProvider>(null);
    const token = useGetToken();
    const tour = useTour();

    useEffect(() => {
        API.UpdateServicesWithToken(token);
    }, [token]);

    const handleCloseSnackbar = (key: SnackbarKey) => (_event: React.MouseEvent) => {
        if (notistackRef?.current?.closeSnackbar) notistackRef.current?.closeSnackbar(key);
    };

    return (
        <SnackbarProvider
            ref={notistackRef}
            autoHideDuration={5000}
            TransitionComponent={Grow}
            action={(key) => (
                <IconButton onClick={handleCloseSnackbar(key)}>
                    <Close sx={{ color: 'white' }} />
                </IconButton>
            )}
        >
            <BrowserRouter>
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
            </BrowserRouter>
        </SnackbarProvider>
    );
}

export default App;
