import { Box, Typography } from '@mui/material';
import BackButton from 'components/Buttons/BackButton';
import { useLocation } from 'react-router-dom';

const ForbiddenPage: React.FC = (props) => {
    const { state } = useLocation();

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
