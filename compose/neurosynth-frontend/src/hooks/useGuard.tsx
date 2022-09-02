import { useAuth0 } from '@auth0/auth0-react';
import { useSnackbar } from 'notistack';
import { useEffect } from 'react';
import { useHistory } from 'react-router-dom';

const useGuard = (
    navigationLink: string,
    snackbarMessage = 'you must be authenticated to view this page',
    shouldNotSeePage = false
) => {
    const { isAuthenticated, isLoading } = useAuth0();
    const history = useHistory();
    const { enqueueSnackbar } = useSnackbar();

    useEffect(() => {
        if ((!isAuthenticated && !isLoading) || shouldNotSeePage) {
            history.push(navigationLink || '/');
            enqueueSnackbar(snackbarMessage, {
                variant: 'warning',
            });
        }
    }, [
        isAuthenticated,
        isLoading,
        history,
        enqueueSnackbar,
        navigationLink,
        shouldNotSeePage,
        snackbarMessage,
    ]);

    return;
};

export default useGuard;
