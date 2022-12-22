import { useAuth0 } from '@auth0/auth0-react';
import { useSnackbar } from 'notistack';
import { useEffect } from 'react';
import { useHistory } from 'react-router-dom';

const useGuard = (
    navigationLink: string,
    snackbarMessage = 'you must be authenticated to view this page',
    shouldNotSeePage = false
) => {
    const history = useHistory();
    const { enqueueSnackbar } = useSnackbar();

    useEffect(() => {
        if (shouldNotSeePage) {
            history.push(navigationLink || '/');
            if (snackbarMessage && snackbarMessage.length > 0) {
                enqueueSnackbar(snackbarMessage, {
                    variant: 'warning',
                });
            }
        }
    }, [enqueueSnackbar, history, navigationLink, shouldNotSeePage, snackbarMessage]);

    return;
};

export default useGuard;
