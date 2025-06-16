import { useSnackbar } from 'notistack';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const useGuard = (
    navigationLink: string,
    snackbarMessage = 'you must be authenticated to view this page',
    shouldNotSeePage = false,
    isLoading: boolean | undefined = false,
    replace?: boolean
) => {
    const navigate = useNavigate();
    const { enqueueSnackbar } = useSnackbar();

    useEffect(() => {
        if (isLoading) {
            return;
        }

        if (shouldNotSeePage) {
            navigate(navigationLink || '/', { replace: replace || false });
            if (snackbarMessage && snackbarMessage.length > 0) {
                enqueueSnackbar(snackbarMessage, {
                    variant: 'warning',
                });
            }
        }
    }, [enqueueSnackbar, isLoading, navigate, navigationLink, replace, shouldNotSeePage, snackbarMessage]);

    return;
};

export default useGuard;
