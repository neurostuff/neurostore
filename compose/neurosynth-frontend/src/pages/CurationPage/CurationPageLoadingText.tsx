import { Box, Typography } from '@mui/material';
import { useEffect, useState } from 'react';

const CurationPageLoadingText: React.FC = (props) => {
    const [curationIsLoading, setCurationIsLoading] = useState(false);

    useEffect(() => {
        function onStorageUpdate() {
            const isLoading = localStorage.getItem(`updateCurationIsLoading`) === 'true';
            if (isLoading) {
                window.onbeforeunload = () => {
                    return '';
                };
            } else {
                window.onbeforeunload = null;
            }
            setCurationIsLoading(isLoading);
        }
        window.addEventListener('storage', onStorageUpdate);
        return () => {
            window.removeEventListener('storage', onStorageUpdate);
        };
    }, []);

    return (
        <Box sx={{ marginLeft: '2rem' }}>
            <Typography
                sx={{
                    color: 'muted.main',
                    fontSize: '1.5rem',
                    display: curationIsLoading ? 'inline' : 'none',
                }}
            >
                updating...
            </Typography>
        </Box>
    );
};

export default CurationPageLoadingText;
