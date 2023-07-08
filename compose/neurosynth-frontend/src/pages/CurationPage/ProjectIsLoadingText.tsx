import { Box, Typography } from '@mui/material';
import { useUpdateProjectIsLoading } from 'pages/Projects/ProjectPage/ProjectStore';

const ProjectIsLoadingText: React.FC = (props) => {
    const updateProjectIsLoading = useUpdateProjectIsLoading();

    return (
        <Box sx={{ marginLeft: '2rem' }}>
            <Typography
                sx={{
                    color: 'muted.main',
                    fontSize: '1.5rem',
                    display: updateProjectIsLoading ? 'inline' : 'none',
                }}
            >
                updating...
            </Typography>
        </Box>
    );
};

export default ProjectIsLoadingText;
