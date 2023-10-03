import { Box } from '@mui/material';
import LoadingButton from 'components/Buttons/LoadingButton/LoadingButton';
import EditAnalyses from 'components/EditStudyComponents/EditAnalyses/EditAnalyses';
import EditStudyDetails from 'components/EditStudyComponents/EditStudyDetails/EditStudyDetails';
import EditStudyPageHeader from 'components/EditStudyComponents/EditStudyHeader/EditStudyHeader';
import EditStudyMetadata from 'components/EditStudyComponents/EditStudyMetadata/EditStudyMetadata';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import { useSnackbar } from 'notistack';
import {
    useInitProjectStoreIfRequired,
    useProjectExtractionAnnotationId,
} from 'pages/Projects/ProjectPage/ProjectStore';
import { useEffect } from 'react';
import { useQueryClient } from 'react-query';
import { useParams } from 'react-router-dom';
import {
    useClearStudyStore,
    useInitStudyStore,
    useStudyStoreIsError,
    useStudyStoreIsValid,
    useStudyHasBeenEdited,
    useStudyId,
    useStudyIsLoading,
    useUpdateStudyInDB,
} from '../StudyStore';
import EditStudyAnnotations from 'components/EditStudyComponents/EditStudyAnnotations/EditStudyAnnotations';
import { useAnnotationIsEdited, useAnnotationIsLoading } from 'stores/AnnotationStore.getters';
import {
    useClearAnnotationStore,
    useInitAnnotationStore,
    useUpdateAnnotationInDB,
} from 'stores/AnnotationStore.actions';
import EditStudyPageStyles from './EditStudyPage.styles';

const EditStudyPage: React.FC = (props) => {
    const { studyId, projectId } = useParams<{ projectId: string; studyId: string }>();
    const queryClient = useQueryClient();
    const snackbar = useSnackbar();

    const annotationId = useProjectExtractionAnnotationId();
    // study stuff
    const studyIsValid = useStudyStoreIsValid();
    const studyIsError = useStudyStoreIsError();
    const studyHasBeenEdited = useStudyHasBeenEdited();
    const storeStudyId = useStudyId();
    const studyIsLoading = useStudyIsLoading();
    const updateStudyInDB = useUpdateStudyInDB();
    const clearStudyStore = useClearStudyStore();
    const initStudyStore = useInitStudyStore();
    // annotation stuff
    const clearAnnotationStore = useClearAnnotationStore();
    const initAnnotationStore = useInitAnnotationStore();
    const updateAnnotationInDB = useUpdateAnnotationInDB();
    const annotationIsEdited = useAnnotationIsEdited();
    const annotationIsLoading = useAnnotationIsLoading();

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

    const handleSave = async () => {
        // CURRTODO: VALIDATE

        // CURRTODO: I fucked up a studyset... i entered data that does not conform to the spec - i probably need to start testing again. Check prod to see what a successfull points request looks like because mine keep failing

        if (!studyIsValid) {
            // currently isValid is only used for coordinates.
            // If we want to check validity for multiple things in the future, we may have to create multiple isValid flags
            snackbar.enqueueSnackbar(
                'A valid analysis needs to have values for statistic, space, and coordinates',
                { variant: 'warning' }
            );
            return;
        }

        try {
            let updatedOccurred = false;

            if (annotationIsEdited) {
                updatedOccurred = true;
                await updateAnnotationInDB();
            }
            if (studyHasBeenEdited) {
                updatedOccurred = true;
                await updateStudyInDB(annotationId as string);
                queryClient.invalidateQueries('studies');
            }

            if (updatedOccurred) {
                snackbar.enqueueSnackbar('study saved successfully', { variant: 'success' });
                queryClient.invalidateQueries('annotations'); // if analyses are updated, we need to do a request to get new annotations
            }
        } catch (e) {
            console.error(e);
            snackbar.enqueueSnackbar('there was an error saving the study', {
                variant: 'error',
            });
        }
    };

    return (
        <StateHandlerComponent
            disableShrink={false}
            isError={false}
            isLoading={!storeStudyId && !studyIsError}
        >
            <EditStudyPageHeader />
            <EditStudyAnnotations />
            <EditStudyDetails />
            <EditStudyMetadata />
            <Box sx={{ marginBottom: '5rem' }}>
                <EditAnalyses />
            </Box>
            <Box sx={EditStudyPageStyles.loadingButtonContainer}>
                <LoadingButton
                    text="save"
                    isLoading={studyIsLoading || annotationIsLoading}
                    variant="contained"
                    loaderColor="secondary"
                    disabled={!studyHasBeenEdited && !annotationIsEdited}
                    disableElevation
                    sx={{ width: '300px' }}
                    onClick={handleSave}
                />
            </Box>
        </StateHandlerComponent>
    );
};

export default EditStudyPage;
