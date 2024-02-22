import { Box } from '@mui/material';
import EditAnalyses from 'components/EditStudyComponents/EditAnalyses/EditAnalyses';
import EditStudyAnnotations from 'components/EditStudyComponents/EditStudyAnnotations/EditStudyAnnotations';
import EditStudyDetails from 'components/EditStudyComponents/EditStudyDetails/EditStudyDetails';
import EditStudyPageHeader from 'components/EditStudyComponents/EditStudyPageHeader/EditStudyPageHeader';
import EditStudyMetadata from 'components/EditStudyComponents/EditStudyMetadata/EditStudyMetadata';
import EditStudySaveButton from 'components/EditStudyComponents/EditStudySaveButton/EditStudySaveButton';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import {
    useInitProjectStoreIfRequired,
    useProjectExtractionAnnotationId,
} from 'pages/Projects/ProjectPage/ProjectStore';
import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useClearAnnotationStore, useInitAnnotationStore } from 'stores/AnnotationStore.actions';
import { useAnnotationId, useGetAnnotationIsLoading } from 'stores/AnnotationStore.getters';
import {
    useClearStudyStore,
    useGetStudyIsLoading,
    useInitStudyStore,
    useStudyId,
} from '../StudyStore';
import EditStudyPageStyles from './EditStudyPage.styles';
import EditStudySwapVersionButton from 'components/EditStudyComponents/EditStudySwapVersionButton/EditStudySwapVersionButton';

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
            <EditStudyPageHeader />
            <EditStudyDetails />
            <EditStudyMetadata />
            <EditStudyAnnotations />
            <Box sx={{ marginBottom: '5rem' }}>
                <EditAnalyses />
            </Box>
            <Box sx={EditStudyPageStyles.loadingButtonContainer}>
                <EditStudySwapVersionButton />
                <EditStudySaveButton />
            </Box>
        </StateHandlerComponent>
    );
};

export default EditStudyPage;
