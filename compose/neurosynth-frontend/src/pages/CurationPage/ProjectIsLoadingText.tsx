import { Box, Typography } from '@mui/material';
import { useUpdateProjectIsLoading } from 'pages/Projects/ProjectPage/ProjectStore';

const ProjectIsLoadingText: React.FC<{ isLoading?: boolean }> = (props) => {
    const updateProjectIsLoading = useUpdateProjectIsLoading();

    const isLoading = updateProjectIsLoading || props.isLoading;

    return (
        <Box sx={{ marginLeft: '2rem' }}>
            <Typography
                sx={{
                    color: 'muted.main',
                    fontSize: '1.25rem',
                    display: isLoading ? 'inline' : 'none',
                }}
            >
                updating...
            </Typography>
        </Box>
    );
};

export default ProjectIsLoadingText;
