import { SnackbarKey, SnackbarProvider } from 'notistack';
import Navbar from './components/Navbar/Navbar';
import BaseNavigation from './pages/BaseNavigation/BaseNavigation';
import { BrowserRouter } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import API from './utils/api';
import useGetToken from './hooks/useGetToken';
import { Grow, IconButton } from '@mui/material';
import Close from '@mui/icons-material/Close';

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
                <Navbar />
                <BaseNavigation />
            </BrowserRouter>
        </SnackbarProvider>
    );
}

export default App;
