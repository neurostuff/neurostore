import { Box, Typography } from '@mui/material';
import EditAnnotations from 'components/EditAnnotations/EditAnnotations';
import NeurosynthBreadcrumbs from 'components/NeurosynthBreadcrumbs/NeurosynthBreadcrumbs';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import { useGetAnnotationById } from 'hooks';
import {
    useInitProjectStoreIfRequired,
    useProjectName,
} from 'pages/Projects/ProjectPage/ProjectStore';
import { useParams } from 'react-router-dom';

const AnnotationsPage: React.FC = () => {
    const { projectId, annotationId }: { projectId: string; annotationId: string } = useParams();
    const { data, isLoading: getAnnotationIsLoading, isError } = useGetAnnotationById(annotationId);

    useInitProjectStoreIfRequired();

    const projectName = useProjectName();

    const viewingThisPageFromProject = !!projectId;

    return (
        <Box sx={{ margin: '1rem 0' }}>
            <StateHandlerComponent isLoading={getAnnotationIsLoading} isError={isError}>
                <Box>
                    <Typography variant="h6">{data?.name}</Typography>
                    <Typography sx={{ color: 'muted.main' }}>{data?.description || ''}</Typography>
                </Box>
                {viewingThisPageFromProject && (
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
                )}
                <EditAnnotations annotationId={annotationId || ''} />
            </StateHandlerComponent>
        </Box>
    );
};

export default AnnotationsPage;
