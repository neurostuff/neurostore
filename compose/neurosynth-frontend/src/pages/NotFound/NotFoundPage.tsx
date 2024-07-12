import { Typography } from '@mui/material';
import Box from '@mui/material/Box';
import BackButton from 'components/Buttons/BackButton';

const NotFoundPage = () => {
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
            <Typography color="secondary" variant="h1">
                404
            </Typography>
            <Typography variant="h3" color="secondary">
                Requested resource not found
            </Typography>
            <BackButton
                sx={{ marginTop: '2rem', fontSize: '1.5rem' }}
                path="/"
                variant="contained"
                text="Return Home"
            />
        </Box>
    );
};

export default NotFoundPage;
