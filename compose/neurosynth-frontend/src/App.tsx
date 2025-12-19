import Close from '@mui/icons-material/Close';
import { IconButton } from '@mui/material';
import Navbar from 'components/Navbar/Navbar';
import useGoogleAnalytics from 'hooks/useGoogleAnalytics';
import { closeSnackbar, SnackbarProvider } from 'notistack';
import BaseNavigation from 'pages/BaseNavigation/BaseNavigation';
import useConfigureAPIWithAuth from './hooks/useConfigureAPIWithAuth';

function App() {
    useConfigureAPIWithAuth();
    useGoogleAnalytics();

    return (
        <SnackbarProvider
            autoHideDuration={8000}
            anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'right',
            }}
            action={(key) => (
                <IconButton onClick={() => closeSnackbar(key)}>
                    <Close sx={{ color: 'white' }} />
                </IconButton>
            )}
        >
            {/* <Banner /> */}
            <Navbar />
            <BaseNavigation />
        </SnackbarProvider>
    );
}

export default App;
