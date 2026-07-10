import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import { Avatar, Box, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import CreateProjectButton from 'components/Buttons/CreateProjectButton';

const ProjectsPageEmptyState = () => {
    return (
        <Box
            sx={{
                display: 'flex',
                alignItems: 'center',
                flexDirection: 'column',
                textAlign: 'center',
                padding: '2rem',
                gap: 2,
            }}
        >
            <Avatar
                sx={{
                    width: 64,
                    height: 64,
                    bgcolor: (theme) => alpha(theme.palette.primary.main, 0.12),
                    color: 'primary.main',
                }}
            >
                <FolderOpenIcon sx={{ fontSize: '2rem' }} />
            </Avatar>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, maxWidth: '420px' }}>
                <Typography variant="h5" sx={{ fontWeight: 600 }}>
                    No projects yet
                </Typography>
                <Typography variant="body1" color="text.secondary">
                    Create your first project to organize curation, coordinate extraction, and run meta-analyses in one
                    place.
                </Typography>
            </Box>
            <CreateProjectButton />
        </Box>
    );
};

export default ProjectsPageEmptyState;
