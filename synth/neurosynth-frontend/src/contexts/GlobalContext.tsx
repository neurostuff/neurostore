import IconButton from '@mui/material/IconButton';
import Snackbar, { SnackbarCloseReason } from '@mui/material/Snackbar';
import { Close } from '@mui/icons-material';
import React, { useCallback, useState } from 'react';
import MuiAlert from '@mui/material/Alert';

export interface IGlobalContext {
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
    showSnackbar: (message: string) => {},
});

const GlobalContextProvider = (props: any) => {
    const [snackbarState, setSnackbarState] = useState<ISnackbar>({
        openSnackbar: false,
        message: '',
        snackbarType: SnackbarType.INFO,
    });

    const handleShowSnackbar = useCallback((message: string, snackbarType: SnackbarType) => {
        setSnackbarState((p) => {
            console.log('close snackbar');
            return {
                openSnackbar: false,
                message: '',
                snackbarType: p.snackbarType,
            };
        });
        setSnackbarState((p) => {
            console.log('set snackbar to true');
            return {
                openSnackbar: true,
                message: message,
                snackbarType: snackbarType,
            };
        });
    }, []);

    const handleSnackbarClose = (event: any, reason?: SnackbarCloseReason) => {
        if (reason === 'clickaway') {
            return;
        }
        setSnackbarState((prevState) => {
            console.log('closing snackbar');
            return {
                openSnackbar: false,
                message: '',
                snackbarType: prevState.snackbarType,
            };
        });
    };

    // store in state in order to prevent rerenders when snackbar is called
    const [globalContextFuncs, _] = useState({
        showSnackbar: handleShowSnackbar,
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
