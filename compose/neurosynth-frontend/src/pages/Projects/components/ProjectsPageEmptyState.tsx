import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import { Box, Typography } from '@mui/material';
import CreateProjectButton from 'components/Buttons/CreateProjectButton';
import ProjectComponentsStyles from 'pages/Project/components/Project.styles';

const ProjectsPageEmptyState: React.FC = () => {
    return (
        <Box
            sx={[
                ProjectComponentsStyles.stepCard,
                ProjectComponentsStyles.getStartedContainer,
                {
                    borderColor: 'muted.main',
                    flexDirection: 'column',
                    textAlign: 'center',
                    padding: '2rem',
                    gap: '1rem',
                },
            ]}
        >
            <FolderOpenIcon sx={{ fontSize: '3rem', color: 'muted.main' }} />
            <Typography variant="h6">No projects yet</Typography>
            <Typography sx={{ color: 'muted.main', maxWidth: '420px' }}>
                Projects organize your curation and meta-analysis workflow. Create your first project to get started.
            </Typography>
            <CreateProjectButton />
        </Box>
    );
};

export default ProjectsPageEmptyState;
