import { Box, Typography } from '@mui/material';
import { useAuth0 } from '@auth0/auth0-react';
import BackButton from 'components/Buttons/BackButton';
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const ForbiddenPage: React.FC = (props) => {
    const { state } = useLocation();
    const navigate = useNavigate();
    const { isAuthenticated, isLoading } = useAuth0();

    useEffect(() => {
        if (isLoading || !isAuthenticated || !state?.redirectOnAuth) return;
        navigate(state.redirectOnAuth, { replace: true });
    }, [isAuthenticated, isLoading, navigate, state]);

    return (
        <Box
            sx={{
                top: '50%',
                position: 'absolute',
                left: '50%',
                transform: `translate(-50%, -50%)`,
            }}
        >
            <Typography variant="h4" color="secondary">
                Forbidden
            </Typography>
            {state?.errorMessage && (
                <Typography mt="1rem" variant="h6" color="muted.main">
                    {state?.errorMessage}
                </Typography>
            )}
            <BackButton
                sx={{ marginTop: '1.5rem', fontSize: '1rem' }}
                path="/"
                disableElevation
                variant="contained"
                text="Return to the homepage"
            />
        </Box>
    );
};

export default ForbiddenPage;
