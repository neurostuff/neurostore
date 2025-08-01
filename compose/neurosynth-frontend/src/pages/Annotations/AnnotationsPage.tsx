import { Box, Typography } from '@mui/material';
import NeurosynthBreadcrumbs from 'components/NeurosynthBreadcrumbs';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import { useGetAnnotationById } from 'hooks';
import EditAnnotationsHotTable from 'pages/Annotations/components/EditAnnotationsHotTable';
import { useProjectExtractionAnnotationId, useProjectName } from 'pages/Project/store/ProjectStore';
import { useParams } from 'react-router-dom';

const AnnotationsPage: React.FC = () => {
    const { annotationId } = useParams<{ annotationId: string }>();
    const annotationIdFromProject = useProjectExtractionAnnotationId();
    const projectName = useProjectName();

    const { projectId } = useParams<{ projectId: string }>();
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
                <EditAnnotationsHotTable annotationId={annotationIdFromProject || annotationId} />
            </StateHandlerComponent>
        </Box>
    );
};

export default AnnotationsPage;
