import { Box, CircularProgress } from '@mui/material';

export function Loading() {
    return (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
            <CircularProgress aria-label="loading" />
        </Box>
    );
}
