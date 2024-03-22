import { useSnackbar } from 'notistack';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const useGuard = (
    navigationLink: string,
    snackbarMessage = 'you must be authenticated to view this page',
    shouldNotSeePage = false
) => {
    const navigate = useNavigate();
    const { enqueueSnackbar } = useSnackbar();

    useEffect(() => {
        if (shouldNotSeePage) {
            navigate(navigationLink || '/');
            if (snackbarMessage && snackbarMessage.length > 0) {
                enqueueSnackbar(snackbarMessage, {
                    variant: 'warning',
                });
            }
        }
    }, [enqueueSnackbar, navigate, navigationLink, shouldNotSeePage, snackbarMessage]);

    return;
};

export default useGuard;
