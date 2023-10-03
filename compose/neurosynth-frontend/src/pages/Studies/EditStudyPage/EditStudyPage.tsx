import { Box } from '@mui/material';
import LoadingButton from 'components/Buttons/LoadingButton/LoadingButton';
import EditAnalyses from 'components/EditStudyComponents/EditAnalyses/EditAnalyses';
import StudyAnnotations from 'components/EditStudyComponents/EditStudyAnnotations/StudyAnnotations';
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
    useIsError,
    useIsValid,
    useStudyHasBeenEdited,
    useStudyId,
    useStudyIsLoading,
    useUpdateStudyInDB,
} from '../StudyStore';

const EditStudyPage: React.FC = (props) => {
    const queryClient = useQueryClient();
    const { studyId, projectId } = useParams<{ projectId: string; studyId: string }>();
    const isValid = useIsValid();
    const isError = useIsError();
    const studyHasBeenEdited = useStudyHasBeenEdited();
    const storeStudyId = useStudyId();
    const isLoading = useStudyIsLoading();
    const updateStudyInDB = useUpdateStudyInDB();
    const annotationId = useProjectExtractionAnnotationId();
    const snackbar = useSnackbar();
    const clearStudyStore = useClearStudyStore();
    const initStudyStore = useInitStudyStore();

    const isEditingFromProject = !!projectId;

    useInitProjectStoreIfRequired();
    // instead of the useInitStudyStoreIfRequired hook,
    // we want to clear and init the study store every time in case the user wants to refresh the page and cancel their edits
    useEffect(() => {
        clearStudyStore();
        initStudyStore(studyId);
    }, [clearStudyStore, initStudyStore, studyId]);

    const handleSave = async () => {
        if (!isValid) {
            // currently isValid is only used for coordinates.
            // If we want to check validity for multiple things in the future, we may have to create multiple isValid flags
            snackbar.enqueueSnackbar(
                'A valid analysis needs to have values for statistic, space, and coordinates',
                { variant: 'warning' }
            );
            return;
        }

        try {
            if (studyHasBeenEdited)
                await updateStudyInDB(isEditingFromProject ? (annotationId as string) : undefined);
            snackbar.enqueueSnackbar('study saved successfully', { variant: 'success' });
            queryClient.invalidateQueries('studies');
            queryClient.invalidateQueries('annotations'); // if analyses are updated, we need to do a request to get new annotations
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
            isLoading={!storeStudyId && !isError}
        >
            <EditStudyPageHeader />

            <StudyAnnotations />
            <EditStudyDetails />
            <EditStudyMetadata />

            <Box sx={{ marginBottom: '5rem' }}>
                <EditAnalyses />
            </Box>
            <Box
                sx={{
                    bottom: 0,
                    padding: '1rem 0',
                    backgroundColor: 'white',
                    position: 'fixed',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    width: {
                        xs: '90%',
                        md: '80%',
                    },
                    zIndex: 1000,
                }}
            >
                <LoadingButton
                    text="save"
                    isLoading={isLoading}
                    variant="contained"
                    loaderColor="secondary"
                    disabled={!studyHasBeenEdited}
                    disableElevation
                    sx={{ width: '300px' }}
                    onClick={handleSave}
                />
            </Box>
        </StateHandlerComponent>
    );
};

export default EditStudyPage;
