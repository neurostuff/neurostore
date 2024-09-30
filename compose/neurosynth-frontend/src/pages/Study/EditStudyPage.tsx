import { ArrowLeft, ArrowRight } from '@mui/icons-material';
import { Box, Button, Typography } from '@mui/material';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import {
    useInitProjectStoreIfRequired,
    useProjectExtractionAnnotationId,
} from 'pages/Project/store/ProjectStore';
import EditStudyAnalyses from 'pages/Study/components/EditStudyAnalyses';
import EditStudyAnnotations from 'pages/Study/components/EditStudyAnnotations';
import EditStudyDetails from 'pages/Study/components/EditStudyDetails';
import EditStudyMetadata from 'pages/Study/components/EditStudyMetadata';
import EditStudyPageHeader from 'pages/Study/components/EditStudyPageHeader';
import EditStudySaveButton from 'pages/Study/components/EditStudySaveButton';
import EditStudyPageStyles from 'pages/Study/EditStudyPage.styles';
import {
    useClearStudyStore,
    useGetStudyIsLoading,
    useInitStudyStore,
    useStudyId,
} from 'pages/Study/store/StudyStore';
import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useClearAnnotationStore, useInitAnnotationStore } from 'stores/AnnotationStore.actions';
import { useAnnotationId, useGetAnnotationIsLoading } from 'stores/AnnotationStore.getters';
import DisplayExtractionTableState from './components/DisplayExtractionTableState';

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
    // instead of the useInitStudyStoreIfRequired hook we call these funcitons in a useEffect as
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
            <EditStudyAnnotations />
            <EditStudyAnalyses />
            <EditStudyDetails />
            <Box sx={{ marginBottom: '5rem' }}>
                <EditStudyMetadata />
            </Box>
            <Box sx={EditStudyPageStyles.loadingButtonContainer}>
                {/* <EditStudySwapVersionButton /> */}
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Button
                        startIcon={<ArrowLeft />}
                        disableElevation
                        sx={{
                            backgroundColor: '#f5f5f5',
                            color: 'black',
                            ':hover': { backgroundColor: 'lightblue' },
                        }}
                    >
                        <Box>
                            <Typography
                                sx={{
                                    textOverflow: 'ellipsis',
                                    maxWidth: '200px',
                                    width: '200px',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textAlign: 'start',
                                }}
                                fontSize="0.6rem"
                            >
                                Giant Panda Identification
                            </Typography>
                            <Typography textAlign="start" fontSize="0.6rem">
                                Back
                            </Typography>
                        </Box>
                    </Button>
                    <Typography variant="body2" sx={{ marginX: '1rem' }}>
                        2 of 3
                    </Typography>
                    <Button
                        endIcon={<ArrowRight />}
                        disableElevation
                        sx={{
                            backgroundColor: '#f5f5f5',
                            color: 'black',
                            ':hover': { backgroundColor: 'lightblue' },
                        }}
                    >
                        <Box>
                            <Typography
                                sx={{
                                    textOverflow: 'ellipsis',
                                    maxWidth: '200px',
                                    width: '200px',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textAlign: 'end',
                                }}
                                fontSize="0.6rem"
                            >
                                Reproducibility of fMRI results across four institutions using a
                                spatial workign memory task
                            </Typography>
                            <Typography textAlign="end" fontSize="0.6rem">
                                Next
                            </Typography>
                        </Box>
                    </Button>
                </Box>
                <DisplayExtractionTableState />
                <EditStudySaveButton />
            </Box>
        </StateHandlerComponent>
    );
};

export default EditStudyPage;
