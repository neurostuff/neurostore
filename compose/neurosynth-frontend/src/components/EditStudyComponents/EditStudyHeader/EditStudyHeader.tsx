import { Box } from '@mui/material';
import FloatingStatusButtons from 'components/EditStudyComponents/FloatingStatusButtons/FloatingStatusButtons';
import NeurosynthBreadcrumbs from 'components/NeurosynthBreadcrumbs/NeurosynthBreadcrumbs';
import { useProjectId, useProjectName } from 'pages/Projects/ProjectPage/ProjectStore';
import { useStudyId, useStudyName } from 'pages/Studies/StudyStore';

const EditStudyPageHeader: React.FC = (props) => {
    const studyId = useStudyId();
    const projectId = useProjectId();
    const studyName = useStudyName();
    const projectName = useProjectName();

    return (
        <>
            <FloatingStatusButtons studyId={studyId || ''} />
            <Box sx={{ marginBottom: '0.5rem' }}>
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
                            isCurrentPage: true,
                        },
                    ]}
                />
            </Box>
        </>
    );
};

export default EditStudyPageHeader;
