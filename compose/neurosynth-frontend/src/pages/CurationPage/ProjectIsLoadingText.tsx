import { Box, Typography } from '@mui/material';
import {
    useProjectMetadataHasUnsavedchanges,
    useUpdateProjectIsLoading,
} from 'pages/Projects/ProjectPage/ProjectStore';

const ProjectIsLoadingText: React.FC<{ isLoading?: boolean }> = (props) => {
    const updateProjectIsLoading = useUpdateProjectIsLoading();
    const projectMetadataHasUnsavedchanges = useProjectMetadataHasUnsavedchanges();

    const isLoading = updateProjectIsLoading || props.isLoading;

    if (isLoading) {
        return (
            <Box sx={{ marginLeft: '2rem' }}>
                <Typography
                    sx={{
                        color: 'muted.main',
                        fontSize: '1.25rem',
                        display: 'inline',
                    }}
                >
                    updating...
                </Typography>
            </Box>
        );
    }

    if (projectMetadataHasUnsavedchanges) {
        return (
            <Box sx={{ marginLeft: '2rem' }}>
                <Typography
                    sx={{
                        color: 'muted.main',
                        fontSize: '1.25rem',
                        display: 'inline',
                    }}
                >
                    unsaved changes
                </Typography>
            </Box>
        );
    }

    return <></>;
};

export default ProjectIsLoadingText;
