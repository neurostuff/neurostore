import { Box, Breadcrumbs, Link, Typography } from '@mui/material';
import EditAnnotations from 'components/EditAnnotations/EditAnnotations';
import { useProjectId, useProjectName } from 'pages/Projects/ProjectPage/ProjectStore';
import { NavLink } from 'react-router-dom';

const AnnotationsPage: React.FC = (props) => {
    const projectId = useProjectId();
    const projectName = useProjectName();

    return (
        <Box>
            <Box sx={{ display: 'flex', marginBottom: '0.5rem' }}>
                <Breadcrumbs>
                    <Link
                        component={NavLink}
                        to="/projects"
                        sx={{ cursor: 'pointer', fontSize: '1.5rem' }}
                        underline="hover"
                    >
                        Projects
                    </Link>
                    <Link
                        component={NavLink}
                        to={`/projects/${projectId}`}
                        sx={{ cursor: 'pointer', fontSize: '1.5rem' }}
                        underline="hover"
                    >
                        {projectName || ''}
                    </Link>
                    <Link
                        component={NavLink}
                        to={`/projects/${projectId}/extraction`}
                        sx={{ cursor: 'pointer', fontSize: '1.5rem' }}
                        underline="hover"
                    >
                        Extraction
                    </Link>
                    <Typography variant="h5" color="secondary">
                        Annotations
                    </Typography>
                </Breadcrumbs>
            </Box>
            <Box sx={{ margin: '1rem 0' }}>
                <EditAnnotations />
            </Box>
        </Box>
    );
};

export default AnnotationsPage;
