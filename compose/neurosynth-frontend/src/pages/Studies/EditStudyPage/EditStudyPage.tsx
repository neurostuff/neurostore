import { Box, Button, Divider } from '@mui/material';
import LoadingButton from 'components/Buttons/LoadingButton/LoadingButton';
import EditAnalyses from 'components/EditStudyComponents/EditAnalyses/EditAnalyses';
import EditStudyDetails from 'components/EditStudyComponents/EditStudyDetails/EditStudyDetails';
import EditStudyMetadata from 'components/EditStudyComponents/EditStudyMetadata/EditStudyMetadata';
import FloatingStatusButtons from 'components/EditStudyComponents/FloatingStatusButtons/FloatingStatusButtons';
import NeurosynthBreadcrumbs from 'components/NeurosynthBreadcrumbs/NeurosynthBreadcrumbs';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import useGetProjectById from 'hooks/requests/useGetProjectById';
import { useSnackbar } from 'notistack';
import {
    useInitProjectStoreIfRequired,
    useProjectExtractionAnnotationId,
} from 'pages/Projects/ProjectPage/ProjectStore';
import { useQueryClient } from 'react-query';
import { useHistory, useParams } from 'react-router-dom';
import {
    useClearStudyStore,
    useInitStudyStore,
    useInitStudyStoreIfRequired,
    useIsValid,
    useStudyHasBeenEdited,
    useStudyId,
    useStudyIsLoading,
    useStudyName,
    useUpdateStudyInDB,
} from '../StudyStore';
import { useEffect } from 'react';

const EditStudyPage: React.FC = (props) => {
    const queryClient = useQueryClient();
    const { studyId, projectId } = useParams<{ projectId: string; studyId: string }>();
    const { data: project } = useGetProjectById(projectId);
    const isValid = useIsValid();
    const studyHasBeenEdited = useStudyHasBeenEdited();
    const storeStudyId = useStudyId();
    const isLoading = useStudyIsLoading();
    const updateStudyInDB = useUpdateStudyInDB();
    const annotationId = useProjectExtractionAnnotationId();
    const snackbar = useSnackbar();
    const studyName = useStudyName();
    const history = useHistory();
    const clearStudyStore = useClearStudyStore();
    const initStudyStore = useInitStudyStore();

    useInitProjectStoreIfRequired();
    // we want to clear and init every time in case the user wants to refresh the page and cancel their edits
    useEffect(() => {
        clearStudyStore();
        initStudyStore(studyId);
    }, [clearStudyStore, initStudyStore, studyId]);

    const handleSave = async () => {
        if (!isValid) {
            // currently isValid is only used for coordinates.
            // If we want to check validity for multiple things in the future, we may have to create multiple isValid flags
            snackbar.enqueueSnackbar('missing coordinates', { variant: 'warning' });
            return;
        }

        try {
            if (studyHasBeenEdited) await updateStudyInDB(annotationId as string);
            snackbar.enqueueSnackbar('study saved successfully', { variant: 'success' });
            queryClient.invalidateQueries('studies');
            queryClient.invalidateQueries('annotation'); // if analyses are updated, we need to do a request to get new annotations
        } catch (e) {
            snackbar.enqueueSnackbar('there was an error saving the study', {
                variant: 'error',
            });
        }
    };

    const isEditingFromProject = !!projectId;

    return (
        <StateHandlerComponent isError={false} isLoading={!storeStudyId}>
            {isEditingFromProject ? (
                <>
                    <FloatingStatusButtons studyId={studyId} />
                    <Box sx={{ marginBottom: '0.5rem' }}>
                        <NeurosynthBreadcrumbs
                            breadcrumbItems={[
                                {
                                    text: 'Projects',
                                    link: '/projects',
                                    isCurrentPage: false,
                                },
                                {
                                    text: project?.name || '',
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
                                    isCurrentPage: false,
                                },
                                {
                                    text: 'Edit',
                                    link: '',
                                    isCurrentPage: true,
                                },
                            ]}
                        />
                    </Box>
                </>
            ) : (
                <Button
                    color="secondary"
                    variant="outlined"
                    sx={{ marginBottom: '1rem' }}
                    onClick={() => history.push(`/studies/${studyId}`)}
                >
                    Return To Study Page
                </Button>
            )}
            <Box>
                <EditStudyDetails />
                <Divider />
            </Box>
            <Box>
                <EditStudyMetadata />
                <Divider />
            </Box>
            <Box>
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
