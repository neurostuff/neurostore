import { Box, Button, Divider } from '@mui/material';
import LoadingButton from 'components/Buttons/LoadingButton/LoadingButton';
import EditAnalyses from 'components/EditStudyComponents/EditAnalyses/EditAnalyses';
import EditStudyDetails from 'components/EditStudyComponents/EditStudyDetails/EditStudyDetails';
import EditStudyMetadata from 'components/EditStudyComponents/EditStudyMetadata/EditStudyMetadata';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import { useSnackbar } from 'notistack';
import { useProjectExtractionAnnotationId } from 'pages/Projects/ProjectPage/ProjectStore';
import { useEffect } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import {
    useClearStudyStore,
    useInitStudyStore,
    useStudyHasBeenEdited,
    useStudyId,
    useStudyIsLoading,
    useUpdateStudyInDB,
} from '../StudyStore';

const EditStudyPage: React.FC = (props) => {
    const { studyId, projectId } = useParams<{ projectId: string; studyId: string }>();
    const initStudyStore = useInitStudyStore();
    const clearStudyStore = useClearStudyStore();
    const studyHasBeenEdited = useStudyHasBeenEdited();
    const storeStudyId = useStudyId();
    const isLoading = useStudyIsLoading();
    const updateStudyInDB = useUpdateStudyInDB();
    const snackbar = useSnackbar();
    const history = useHistory();

    useEffect(() => {
        clearStudyStore();
        initStudyStore(studyId);
    }, [clearStudyStore, initStudyStore, studyId]);

    const handleSave = async () => {
        try {
            if (studyHasBeenEdited) await updateStudyInDB();
            snackbar.enqueueSnackbar('study saved successfully', { variant: 'success' });
        } catch (e) {
            snackbar.enqueueSnackbar('there was an error saving the study', {
                variant: 'error',
            });
        }
    };

    return (
        <StateHandlerComponent isError={false} isLoading={!storeStudyId}>
            <Box
                sx={{
                    position: 'sticky',
                    top: 0,
                    padding: '1rem 0',
                    backgroundColor: 'white',
                    display: 'flex',
                    justifyContent: 'space-between',
                    zIndex: 1000,
                }}
            >
                <Button
                    onClick={() =>
                        history.push(`/projects/${projectId}/extraction/studies/${studyId}`)
                    }
                    disableElevation
                    variant="outlined"
                    color="error"
                    sx={{ width: '300px' }}
                    size="large"
                >
                    cancel
                </Button>
                <LoadingButton
                    size="large"
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
        </StateHandlerComponent>
    );
};

export default EditStudyPage;
