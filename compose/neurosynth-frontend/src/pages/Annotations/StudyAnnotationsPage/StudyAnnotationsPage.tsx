import { Box, Breadcrumbs, Link, Typography } from '@mui/material';
import EditStudyAnnotations from 'components/EditAnnotations/EditStudyAnnotations';
import { useProjectId, useProjectName } from 'pages/Projects/ProjectPage/ProjectStore';
import { useStudyName } from 'pages/Studies/StudyStore';
import { NavLink, useParams } from 'react-router-dom';

const StudyAnnotationsPage: React.FC = (props) => {
    const { studyId } = useParams<{
        studyId: string;
    }>();
    const projectId = useProjectId();
    const projectName = useProjectName();
    const studyName = useStudyName();

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
                    <Link
                        component={NavLink}
                        to={`/projects/${projectId}/extraction/studies/${studyId}`}
                        sx={{ cursor: 'pointer', fontSize: '1.5rem' }}
                        underline="hover"
                    >
                        {studyName || ''}
                    </Link>
                    <Typography variant="h5" sx={{ color: 'secondary.main' }}>
                        Annotations
                    </Typography>
                </Breadcrumbs>
            </Box>
            <Box>
                <EditStudyAnnotations />
            </Box>
        </Box>
    );
};

export default StudyAnnotationsPage;
