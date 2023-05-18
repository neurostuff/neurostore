import { Box } from '@mui/material';
import EditStudyAnnotations from 'components/EditAnnotations/EditStudyAnnotations';
import NeurosynthBreadcrumbs from 'components/NeurosynthBreadcrumbs/NeurosynthBreadcrumbs';
import { useProjectId, useProjectName } from 'pages/Projects/ProjectPage/ProjectStore';
import { useStudyName } from 'pages/Studies/StudyStore';
import { useParams } from 'react-router-dom';

const StudyAnnotationsPage: React.FC = (props) => {
    const { studyId } = useParams<{
        studyId: string;
    }>();
    const projectId = useProjectId();
    const projectName = useProjectName();
    const studyName = useStudyName();

    return (
        <Box>
            <Box sx={{ display: 'flex', marginBottom: '1rem' }}>
                <NeurosynthBreadcrumbs
                    breadcrumbItems={[
                        {
                            text: 'Projects',
                            link: '/projects',
                            isCurrentPage: false,
                        },
                        {
                            text: projectName || '',
                            link: `/projects/${projectId}`,
                            isCurrentPage: false,
                        },
                        {
                            text: 'Extraction',
                            link: `/projects/${projectId}/extraction`,
                            isCurrentPage: false,
                        },
                        {
                            text: studyName || '',
                            link: `/projects/${projectId}/extraction/studies/${studyId}`,
                            isCurrentPage: false,
                        },
                        {
                            text: 'Annotations',
                            link: '',
                            isCurrentPage: true,
                        },
                    ]}
                />
            </Box>
            <Box>
                <EditStudyAnnotations />
            </Box>
        </Box>
    );
};

export default StudyAnnotationsPage;
