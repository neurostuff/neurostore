import { Box } from '@mui/material';
import LoadingButton from 'components/Buttons/LoadingButton/LoadingButton';
import EditAnalyses from 'components/EditStudyComponents/EditAnalyses/EditAnalyses';
import EditStudyAnnotations from 'components/EditStudyComponents/EditStudyAnnotations/EditStudyAnnotations';
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
    useClearAnnotationStore,
    useInitAnnotationStore,
    useUpdateAnnotationInDB,
    useUpdateAnnotationNotes,
} from 'stores/AnnotationStore.actions';
import {
    useAnnotationId,
    useAnnotationIsEdited,
    useAnnotationIsLoading,
    useAnnotationNotes,
} from 'stores/AnnotationStore.getters';
import {
    useClearStudyStore,
    useInitStudyStore,
    useStudyAnalyses,
    useStudyHasBeenEdited,
    useStudyId,
    useStudyIsLoading,
    useStudyStoreIsError,
    useUpdateStudyInDB,
} from '../StudyStore';
import EditStudyPageStyles from './EditStudyPage.styles';
import { hasDuplicateStudyAnalysisNames, hasEmptyStudyPoints } from './EditStudyPage.helpers';
import { AnalysisReturn } from 'neurostore-typescript-sdk';

const EditStudyPage: React.FC = (props) => {
    const { studyId } = useParams<{ studyId: string }>();
    const queryClient = useQueryClient();
    const { enqueueSnackbar } = useSnackbar();
    const analyses = useStudyAnalyses();

    const annotationId = useProjectExtractionAnnotationId();
    // study stuff
    const studyIsError = useStudyStoreIsError();
    const studyHasBeenEdited = useStudyHasBeenEdited();
    const storeStudyId = useStudyId();
    const studyIsLoading = useStudyIsLoading();
    const updateStudyInDB = useUpdateStudyInDB();
    const clearStudyStore = useClearStudyStore();
    const initStudyStore = useInitStudyStore();
    // annotation stuff
    const storeAnnotationId = useAnnotationId();
    const clearAnnotationStore = useClearAnnotationStore();
    const notes = useAnnotationNotes();
    const initAnnotationStore = useInitAnnotationStore();
    const updateAnnotationNotes = useUpdateAnnotationNotes();
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

    const handleUpdateStudyInDB = async () => {
        await updateStudyInDB(annotationId as string);
        queryClient.invalidateQueries('studies');
        queryClient.invalidateQueries('annotations');

        enqueueSnackbar('Study saved', { variant: 'success' });
    };

    const handleUpdateBothInDB = async () => {
        const updatedStudy = await updateStudyInDB(annotationId as string);
        const updatedNotes = [...(notes || [])];
        updatedNotes.forEach((note, index) => {
            if (note.isNew) {
                const foundAnalysis = ((updatedStudy.analyses || []) as AnalysisReturn[]).find(
                    (analysis) => analysis.name === note.analysis_name
                );
                if (!foundAnalysis) return;

                updatedNotes[index] = {
                    ...updatedNotes[index],
                    analysis: foundAnalysis.id,
                };
            }
        });
        updateAnnotationNotes(updatedNotes);
        await updateAnnotationInDB();

        queryClient.invalidateQueries('studies');
        queryClient.invalidateQueries('annotations');

        enqueueSnackbar('Study and annotation saved', { variant: 'success' });
    };

    const handleUpdateAnnotationInDB = async () => {
        await updateAnnotationInDB();
        queryClient.invalidateQueries('annotations');
        enqueueSnackbar('Annotation saved', { variant: 'success' });
    };

    const handleUpdateDB = () => {
        try {
            if (studyHasBeenEdited && annotationIsEdited) {
                handleUpdateBothInDB();
            } else if (studyHasBeenEdited) {
                handleUpdateStudyInDB();
            } else if (annotationIsEdited) {
                handleUpdateAnnotationInDB();
            }
        } catch (e) {
            console.error(e);
            enqueueSnackbar('There was an error saving to the database', {
                variant: 'error',
            });
        }
    };

    const handleSave = async () => {
        const { isError: hasDuplicateError, errorMessage: hasDuplicateErrorMessage } =
            hasDuplicateStudyAnalysisNames(analyses);
        if (hasDuplicateError) {
            enqueueSnackbar(hasDuplicateErrorMessage, { variant: 'warning' });
            return;
        }

        const { isError: emptyPointError, errorMessage: emptyPointErrorMessage } =
            hasEmptyStudyPoints(analyses);
        if (emptyPointError) {
            enqueueSnackbar(emptyPointErrorMessage, { variant: 'warning' });
            return;
        }

        handleUpdateDB();
    };

    return (
        <StateHandlerComponent
            disableShrink={false}
            isError={false}
            isLoading={!storeStudyId && !studyIsError && !storeAnnotationId}
        >
            <EditStudyPageHeader />
            <EditStudyDetails />
            <EditStudyMetadata />
            <EditStudyAnnotations />
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
