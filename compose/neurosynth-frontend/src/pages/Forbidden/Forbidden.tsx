import { Box, Typography } from '@mui/material';
import BackButton from 'components/Buttons/BackButton/BackButton';

const ForbiddenPage: React.FC = (props) => {
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
                401
            </Typography>
            <Typography variant="h3" color="secondary">
                You can't access this page!
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

export default ForbiddenPage;
