import { Typography } from '@mui/material';
import Box from '@mui/material/Box';
import BackButton from 'components/Buttons/BackButton';
import { useLocation } from 'react-router-dom';

const NotFoundPage = () => {
    const { state } = useLocation();

    return (
        <Box
            sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                marginTop: '4rem',
            }}
        >
            <Typography color="secondary" variant="h4">
                Not found
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

export default NotFoundPage;
