import {
    Box,
    Breadcrumbs,
    Button,
    Divider,
    IconButton,
    Link,
    Tooltip,
    Typography,
} from '@mui/material';
import LoadingButton from 'components/Buttons/LoadingButton/LoadingButton';
import EditAnalyses from 'components/EditStudyComponents/EditAnalyses/EditAnalyses';
import EditStudyDetails from 'components/EditStudyComponents/EditStudyDetails/EditStudyDetails';
import EditStudyMetadata from 'components/EditStudyComponents/EditStudyMetadata/EditStudyMetadata';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import { useSnackbar } from 'notistack';
import { useEffect } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import {
    useClearStudyStore,
    useInitStudyStore,
    useIsValid,
    useStudyHasBeenEdited,
    useStudyId,
    useStudyIsLoading,
    useStudyName,
    useUpdateStudyInDB,
} from '../StudyStore';
import { useProjectExtractionAnnotationId } from 'pages/Projects/ProjectPage/ProjectStore';
import useGetProjectById from 'hooks/requests/useGetProjectById';
import CheckIcon from '@mui/icons-material/Check';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import FloatingStatusButtons from 'components/EditStudyComponents/FloatingStatusButtons/FloatingStatusButtons';

const EditStudyPage: React.FC = (props) => {
    const { studyId, projectId } = useParams<{ projectId: string; studyId: string }>();
    const { data: project } = useGetProjectById(projectId);
    const isValid = useIsValid();
    const initStudyStore = useInitStudyStore();
    const clearStudyStore = useClearStudyStore();
    const studyHasBeenEdited = useStudyHasBeenEdited();
    const storeStudyId = useStudyId();
    const isLoading = useStudyIsLoading();
    const updateStudyInDB = useUpdateStudyInDB();
    const annotationId = useProjectExtractionAnnotationId();
    const snackbar = useSnackbar();
    const studyName = useStudyName();

    useEffect(() => {
        clearStudyStore();
        initStudyStore(studyId);
    }, [clearStudyStore, initStudyStore, studyId]);

    const handleSave = async () => {
        if (!isValid) return;

        try {
            if (studyHasBeenEdited) await updateStudyInDB(annotationId as string);
            snackbar.enqueueSnackbar('study saved successfully', { variant: 'success' });
        } catch (e) {
            snackbar.enqueueSnackbar('there was an error saving the study', {
                variant: 'error',
            });
        }
    };

    return (
        <StateHandlerComponent isError={false} isLoading={!storeStudyId}>
            <FloatingStatusButtons />
            <Box sx={{ display: 'flex', marginBottom: '0.5rem' }}>
                <Breadcrumbs>
                    <Link
                        component={NavLink}
                        to="/projects"
                        sx={{ cursor: 'pointer', fontSize: '1.5rem' }}
                        underline="hover"
                    >
                        Projects
                    </Link>
                    <Link
                        component={NavLink}
                        to={`/projects/${projectId}`}
                        sx={{ cursor: 'pointer', fontSize: '1.5rem' }}
                        underline="hover"
                    >
                        {project?.name || ''}
                    </Link>
                    <Link
                        component={NavLink}
                        to={`/projects/${projectId}/extraction`}
                        sx={{ cursor: 'pointer', fontSize: '1.5rem' }}
                        underline="hover"
                    >
                        Extraction
                    </Link>
                    <Link
                        component={NavLink}
                        to={`/projects/${projectId}/extraction/studies/${studyId}`}
                        sx={{ cursor: 'pointer', fontSize: '1.5rem' }}
                        underline="hover"
                    >
                        {studyName || ''}
                    </Link>
                    <Typography variant="h5" sx={{ color: 'secondary.main' }}>
                        Edit
                    </Typography>
                </Breadcrumbs>
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
                    disabled={!studyHasBeenEdited || !isValid}
                    disableElevation
                    sx={{ width: '300px' }}
                    onClick={handleSave}
                />
            </Box>
        </StateHandlerComponent>
    );
};

export default EditStudyPage;
