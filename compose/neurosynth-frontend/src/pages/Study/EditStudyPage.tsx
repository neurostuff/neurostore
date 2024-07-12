import { Box } from '@mui/material';
import EditStudyAnalyses from 'pages/Study/components/EditStudyAnalyses';
import EditStudyDetails from 'pages/Study/components/EditStudyDetails';
import EditStudyMetadata from 'pages/Study/components/EditStudyMetadata';
import EditStudySaveButton from 'pages/Study/components/EditStudySaveButton';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import {
    useInitProjectStoreIfRequired,
    useProjectExtractionAnnotationId,
    useProjectUser,
} from 'pages/Project/store/ProjectStore';
import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useClearAnnotationStore, useInitAnnotationStore } from 'stores/AnnotationStore.actions';
import { useAnnotationId, useGetAnnotationIsLoading } from 'stores/AnnotationStore.getters';
import {
    useClearStudyStore,
    useGetStudyIsLoading,
    useInitStudyStore,
    useStudyId,
} from 'pages/Study/store/StudyStore';
import EditStudyPageStyles from 'pages/Study/EditStudyPage.styles';
import useUserCanEdit from 'hooks/useUserCanEdit';
import EditStudyAnnotations from 'pages/Study/components/EditStudyAnnotations';
import EditStudyPageHeader from 'pages/Study/components/EditStudyPageHeader';
import EditStudySwapVersionButton from 'pages/Study/components/EditStudySwapVersionButton';

const EditStudyPage: React.FC = (props) => {
    const { studyId } = useParams<{ studyId: string }>();

    const annotationId = useProjectExtractionAnnotationId();
    // study stuff
    const getStudyIsLoading = useGetStudyIsLoading();
    const clearStudyStore = useClearStudyStore();
    const initStudyStore = useInitStudyStore();
    const studyStoreId = useStudyId();
    // annotation stuff
    const annotationStoreId = useAnnotationId();
    const clearAnnotationStore = useClearAnnotationStore();
    const initAnnotationStore = useInitAnnotationStore();
    const getAnnotationIsLoading = useGetAnnotationIsLoading();
    const projectUser = useProjectUser();
    const canEdit = useUserCanEdit(projectUser || undefined);

    useInitProjectStoreIfRequired();
    // instead of the useInitStudyStoreIfRequired hook,
    // we want to clear and init the study store every time in case the user wants to refresh the page and cancel their edits
    useEffect(() => {
        clearStudyStore();
        clearAnnotationStore();
        initStudyStore(studyId);
        initAnnotationStore(annotationId);
    }, [
        annotationId,
        clearAnnotationStore,
        clearStudyStore,
        initAnnotationStore,
        initStudyStore,
        studyId,
    ]);

    return (
        <StateHandlerComponent
            disableShrink={false}
            isError={false}
            isLoading={
                !studyStoreId || !annotationStoreId || getStudyIsLoading || getAnnotationIsLoading
            }
        >
            <EditStudyPageHeader disabled={!canEdit} />
            <EditStudyAnnotations disabled={!canEdit} />
            <EditStudyAnalyses disabled={!canEdit} />
            <EditStudyDetails disabled={!canEdit} />
            <Box sx={{ marginBottom: '5rem' }}>
                <EditStudyMetadata disabled={!canEdit} />
            </Box>
            {canEdit && (
                <Box sx={EditStudyPageStyles.loadingButtonContainer}>
                    <EditStudySwapVersionButton />
                    <EditStudySaveButton />
                </Box>
            )}
        </StateHandlerComponent>
    );
};

export default EditStudyPage;
