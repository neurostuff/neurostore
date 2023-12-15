import { Box, Typography } from '@mui/material';
import EditAnnotationsHotTable from 'components/HotTables/EditAnnotationsHotTable/EditAnnotationsHotTable';
import NeurosynthBreadcrumbs from 'components/NeurosynthBreadcrumbs/NeurosynthBreadcrumbs';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import { useGetAnnotationById } from 'hooks';
import {
    useInitProjectStoreIfRequired,
    useProjectExtractionAnnotationId,
    useProjectName,
} from 'pages/Projects/ProjectPage/ProjectStore';
import { useParams } from 'react-router-dom';

const AnnotationsPage: React.FC = () => {
    const { annotationId } = useParams<{ annotationId: string }>();
    useInitProjectStoreIfRequired();
    const annotationIdFromProject = useProjectExtractionAnnotationId();
    const projectName = useProjectName();

    const { projectId }: { projectId: string } = useParams();
    const {
        data,
        isLoading: getAnnotationIsLoading,
        isError,
    } = useGetAnnotationById(annotationIdFromProject || annotationId);

    const viewingThisPageFromProject = !!projectId;

    return (
        <Box sx={{ margin: '1rem 0' }}>
            <StateHandlerComponent isLoading={getAnnotationIsLoading} isError={isError}>
                {viewingThisPageFromProject && (
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
                                    text: 'Annotations',
                                    link: '',
                                    isCurrentPage: true,
                                },
                            ]}
                        />
                    </Box>
                )}
                <Box>
                    <Typography variant="h5" gutterBottom>
                        {data?.name}
                    </Typography>
                    <Typography sx={{ color: 'muted.main' }}>{data?.description || ''}</Typography>
                </Box>
                <EditAnnotationsHotTable
                    annotationId={annotationIdFromProject || annotationId}
                    isViewingFromProject={viewingThisPageFromProject}
                />
            </StateHandlerComponent>
        </Box>
    );
};

export default AnnotationsPage;
