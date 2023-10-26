import { Box } from '@mui/material';
import EditAnnotations from 'components/EditAnnotations/EditAnnotations';
import NeurosynthBreadcrumbs from 'components/NeurosynthBreadcrumbs/NeurosynthBreadcrumbs';
import { useProjectId, useProjectName } from 'pages/Projects/ProjectPage/ProjectStore';

const AnnotationsPage: React.FC = (props) => {
    const projectId = useProjectId();
    const projectName = useProjectName();

    return (
        <Box>
            <Box sx={{ marginBottom: '1rem' }}>
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
                            text: 'Annotations',
                            link: '',
                            isCurrentPage: true,
                        },
                    ]}
                />
            </Box>

            <Box sx={{ margin: '1rem 0' }}>
                <EditAnnotations />
            </Box>
        </Box>
    );
};

export default AnnotationsPage;
