import { Box, Typography } from '@mui/material';
import { useEffect, useState } from 'react';

const ProjectIsLoadingText: React.FC = (props) => {
    const [projectIsLoading, setProjectIsLoading] = useState(false);

    useEffect(() => {
        function onStorageUpdate() {
            const isLoading = localStorage.getItem(`updateProjectIsLoading`) === 'true';
            if (isLoading) {
                window.onbeforeunload = () => {
                    return '';
                };
            } else {
                window.onbeforeunload = null;
            }
            setProjectIsLoading(isLoading);
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
                    display: projectIsLoading ? 'inline' : 'none',
                }}
            >
                updating...
            </Typography>
        </Box>
    );
};

export default ProjectIsLoadingText;
