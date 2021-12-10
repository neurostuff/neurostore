import IconButton from '@mui/material/IconButton';
import Snackbar from '@mui/material/Snackbar';
import { Close } from '@mui/icons-material';
import React, { useCallback, useState } from 'react';
import MuiAlert from '@mui/material/Alert';
import API from '../utils/api';

export interface IGlobalContext {
    handleToken: (token: string) => void;
    onLogout: () => void;
    showSnackbar: (message: string, snackbarType: SnackbarType) => void;
}

export enum SnackbarType {
    ERROR = 'error',
    WARNING = 'warning',
    SUCCESS = 'success',
    INFO = 'info',
}

interface ISnackbar {
    openSnackbar: boolean;
    message: string;
    snackbarType: SnackbarType;
}

const GlobalContext = React.createContext<IGlobalContext>({
    handleToken: (token: string) => {},
    onLogout: () => {},
    showSnackbar: (message: string) => {},
});

const GlobalContextProvider = (props: any) => {
    const [token, setToken] = useState('');
    const [snackbarState, setSnackbarState] = useState<ISnackbar>({
        openSnackbar: false,
        message: '',
        snackbarType: SnackbarType.INFO,
    });

    const handleTokenFunc = useCallback(
        (givenToken: string) => {
            if (givenToken !== token) {
                API.UpdateServicesWithToken(givenToken);
                setToken(givenToken);
            }
        },
        [token]
    );

    const handleShowSnackbar = useCallback((message: string, snackbarType: SnackbarType) => {
        setSnackbarState({
            openSnackbar: true,
            message: message,
            snackbarType: snackbarType,
        });
    }, []);

    const handleSnackbarClose = (event?: React.SyntheticEvent, reason?: string) => {
        if (reason === 'clickaway') {
            return;
        }

        setSnackbarState((prevState) => ({
            openSnackbar: false,
            message: '',
            snackbarType: prevState.snackbarType,
        }));
    };

    const handleLogout = useCallback(() => {}, []);

    // store in state in order to prevent rerenders when snackbar is called
    const [globalContextFuncs, _] = useState({
        showSnackbar: handleShowSnackbar,
        handleToken: handleTokenFunc,
        onLogout: handleLogout,
    });

    const action = (
        <IconButton size="small" color="inherit" onClick={handleSnackbarClose}>
            <Close fontSize="small" />
        </IconButton>
    );

    return (
        <GlobalContext.Provider value={globalContextFuncs}>
            {props.children}
            <Snackbar
                open={snackbarState.openSnackbar}
                autoHideDuration={6000}
                onClose={handleSnackbarClose}
                anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
                <MuiAlert
                    action={action}
                    onClose={handleSnackbarClose}
                    severity={snackbarState.snackbarType}
                >
                    {snackbarState.message}
                </MuiAlert>
            </Snackbar>
        </GlobalContext.Provider>
    );
};

export { GlobalContext, GlobalContextProvider };
