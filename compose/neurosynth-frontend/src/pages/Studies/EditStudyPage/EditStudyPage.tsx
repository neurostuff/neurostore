import { Add } from '@mui/icons-material';
import { Box, Button, Typography } from '@mui/material';
import LoadingButton from 'components/Buttons/LoadingButton/LoadingButton';
import EditAnalyses from 'components/EditStudyComponents/EditAnalyses/EditAnalyses';
import EditStudyDetails from 'components/EditStudyComponents/EditStudyDetails/EditStudyDetails';
import EditStudyMetadata from 'components/EditStudyComponents/EditStudyMetadata/EditStudyMetadata';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import { useSnackbar } from 'notistack';
import { useEffect } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import {
    useClearStudyStore,
    useInitStudyStore,
    useIsEdited,
    useStudyId,
    useStudyIsLoading,
    useStudyMetadata,
    useUpdateStudyInDB,
} from '../StudyStore';

const EditStudyPage: React.FC = (props) => {
    const { studyId, projectId } = useParams<{ projectId: string; studyId: string }>();
    const initStudyStore = useInitStudyStore();
    const clearStudyStore = useClearStudyStore();
    const hasBeenEdited = useIsEdited();
    const storeStudyId = useStudyId();
    const isLoading = useStudyIsLoading();
    const updateStudyInDB = useUpdateStudyInDB();
    const snackbar = useSnackbar();
    const history = useHistory();

    useEffect(() => {
        clearStudyStore();
        initStudyStore(studyId);
    }, [clearStudyStore, initStudyStore, studyId]);

    const handleSave = () => {
        updateStudyInDB()
            .then((res) => {
                snackbar.enqueueSnackbar('study saved successfully', { variant: 'success' });
            })
            .catch((e) => {
                snackbar.enqueueSnackbar('there was an error saving the study', {
                    variant: 'error',
                });
            });
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
                    zIndex: 10,
                }}
            >
                <Button
                    onClick={() =>
                        history.push(`/projects/${projectId}/extraction/studies/${studyId}`)
                    }
                    disableElevation
                    variant="outlined"
                    color="error"
                    sx={{ width: '150px' }}
                >
                    cancel
                </Button>
                <LoadingButton
                    text="save"
                    isLoading={isLoading}
                    variant="contained"
                    disabled={!hasBeenEdited}
                    disableElevation
                    sx={{ width: '150px' }}
                    onClick={handleSave}
                />
            </Box>
            <Box sx={{ margin: '0.5rem 0' }}>
                <EditStudyDetails />
            </Box>
            <Box sx={{ marginBottom: '0.5rem' }}>
                <EditStudyMetadata />
            </Box>
            <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography
                        sx={{
                            fontWeight: 'bold',
                            marginLeft: '16px',
                            marginTop: '1rem',
                            marginBottom: '1rem',
                        }}
                        variant="h6"
                        gutterBottom
                    >
                        Analyses
                    </Typography>
                    <Box>
                        <Button sx={{ width: '150px' }} variant="outlined" startIcon={<Add />}>
                            analysis
                        </Button>
                    </Box>
                </Box>
                <EditAnalyses />
            </Box>
        </StateHandlerComponent>
    );
};

export default EditStudyPage;
