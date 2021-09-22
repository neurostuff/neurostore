import { IconButton, Snackbar } from '@material-ui/core';
import { Close } from '@material-ui/icons';
import React, { useEffect, useState } from 'react';
import API from '../utils/api';

import { makeStyles } from '@material-ui/core';

const SnackbarStyles = makeStyles((theme) => ({
    error: {
        '& .MuiSnackbarContent-root': {
            backgroundColor: theme.palette.error.main,
            color: 'white',
        },
    },
    warning: {
        '& .MuiSnackbarContent-root': {
            backgroundColor: theme.palette.warning.main,
            color: 'black',
        },
    },
    success: {
        '& .MuiSnackbarContent-root': {
            backgroundColor: theme.palette.success.main,
            color: 'white',
        },
    },
    default: {},
}));

export interface IGlobalContext {
    token: string;
    updateToken: (token: string) => void;
    onLogout: () => void;
    showSnackbar: (message: string, snackbarType: SnackbarType) => void;
}

export enum SnackbarType {
    ERROR = 'error',
    WARNING = 'warning',
    SUCCESS = 'success',
    DEFAULT = 'default',
}

interface ISnackbar {
    openSnackbar: boolean;
    message: string;
    snackbarType: SnackbarType;
}

const GlobalContext = React.createContext<IGlobalContext>({
    token: '',
    updateToken: (token: string) => {},
    onLogout: () => {},
    showSnackbar: (message: string) => {},
});

const GlobalContextProvider = (props: any) => {
    const classes = SnackbarStyles();
    const [token, setToken] = useState('');
    const [snackbarState, setSnackbarState] = useState<ISnackbar>({
        openSnackbar: false,
        message: '',
        snackbarType: SnackbarType.DEFAULT,
    });

    const getClass = (type: SnackbarType) => {
        switch (type) {
            case SnackbarType.SUCCESS:
                return classes.success;
            case SnackbarType.DEFAULT:
                return classes.default;
            case SnackbarType.ERROR:
                return classes.error;
            case SnackbarType.WARNING:
                return classes.warning;
        }
    };

    const handleUpdateToken = (givenToken: string) => {
        if (givenToken !== token) {
            API.UpdateServicesWithToken(givenToken);
            setToken(givenToken);
        }
    };

    useEffect(() => {
        console.log(snackbarState.snackbarType);
    }, [snackbarState.snackbarType]);

    const handleShowSnackbar = (message: string, snackbarType: SnackbarType) => {
        setSnackbarState({
            openSnackbar: true,
            message: message,
            snackbarType: snackbarType,
        });
    };

    const handleSnackbarClose = () => {
        setSnackbarState((prevState) => ({
            openSnackbar: false,
            message: '',
            snackbarType: prevState.snackbarType,
        }));
    };

    const handleLogout = () => {};

    const action = (
        <IconButton size="small" color="inherit" onClick={handleSnackbarClose}>
            <Close fontSize="small" />
        </IconButton>
    );

    return (
        <GlobalContext.Provider
            value={{
                token: token,
                showSnackbar: handleShowSnackbar,
                updateToken: handleUpdateToken,
                onLogout: handleLogout,
            }}
        >
            {props.children}
            <Snackbar
                className={getClass(snackbarState.snackbarType)}
                open={snackbarState.openSnackbar}
                message={snackbarState.message}
                autoHideDuration={5000}
                onClose={handleSnackbarClose}
                action={action}
            />
        </GlobalContext.Provider>
    );
};

export { GlobalContext, GlobalContextProvider };
