import { ArrowBack } from '@mui/icons-material';
import { Box, Button, useMediaQuery, useTheme } from '@mui/material';
import ConfirmationDialog from 'components/Dialogs/ConfirmationDialog';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import { hasUnsavedStudyChanges, unsetUnloadHandler } from 'helpers/BeforeUnload.helpers';
import { useProjectExtractionAnnotationId } from 'pages/Project/store/ProjectStore';
import EditStudyAnalysesCBMA from 'pages/StudyCBMA/components/EditStudyAnalysesCBMA';
import EditStudyAnnotations from 'pages/StudyCBMA/components/EditStudyAnnotations';
import EditStudyDetails from 'pages/StudyCBMA/components/EditStudyDetails';
import EditStudyMetadata from 'pages/StudyCBMA/components/EditStudyMetadata';
import EditStudyPageHeader from 'pages/StudyCBMA/components/EditStudyPageHeader';
import StudyCBMAPageStyles from 'pages/StudyCBMA/StudyCBMA.styles';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useClearAnnotationStore, useInitAnnotationStore } from 'stores/annotation/AnnotationStore.actions';
import { useAnnotationId, useGetAnnotationIsLoading } from 'stores/annotation/AnnotationStore.getters';
import { useClearStudyStore, useGetStudyIsLoading, useInitStudyStore, useStudyId } from 'stores/study/StudyStore';
import DisplayExtractionTableState from '../StudyCBMA/components/DisplayExtractionTableState';
import EditStudyCompleteButton from '../StudyCBMA/components/EditStudyCompleteButton';
import EditStudyToolbar from '../StudyCBMA/components/EditStudyToolbar';
import EditStudyAnalysisIBMA3 from './components/EditStudyAnalysisIBMA3';

const StudyIBMAPage: React.FC = () => {
    const { projectId, studyId } = useParams<{ projectId: string; studyId: string }>();

    const navigate = useNavigate();
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

    const theme = useTheme();
    const mdDown = useMediaQuery(theme.breakpoints.down('md'));

    // instead of the useInitStudyStoreIfRequired hook we call these funcitons in a useEffect as
    // we want to clear and init the study store every time in case the user wants to refresh the page and cancel their edits
    useEffect(() => {
        clearStudyStore();
        clearAnnotationStore();
        initStudyStore(studyId);
        initAnnotationStore(annotationId);
    }, [annotationId, clearAnnotationStore, clearStudyStore, initAnnotationStore, initStudyStore, studyId]);

    const [confirmationDialogIsOpen, setConfirmationDialogIsOpen] = useState(false);

    const handleBackToExtraction = () => {
        const hasUnsavedChanges = hasUnsavedStudyChanges();
        if (hasUnsavedChanges) {
            setConfirmationDialogIsOpen(true);
            return;
        }

        navigate(`/projects/${projectId}/extraction`);
    };

    const handleCloseConfirmationDialog = (ok: boolean | undefined) => {
        setConfirmationDialogIsOpen(false);
        if (!ok) return;

        unsetUnloadHandler('study');
        unsetUnloadHandler('annotation');
        handleBackToExtraction();
    };

    return (
        <StateHandlerComponent
            disableShrink={false}
            isError={false}
            isLoading={!studyStoreId || !annotationStoreId || getStudyIsLoading || getAnnotationIsLoading}
        >
            <Box sx={{ mb: 4 }}>
                <EditStudyPageHeader />
            </Box>
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: {
                        xs: 'column-reverse',
                        md: 'row',
                    },
                }}
            >
                <Box
                    sx={{
                        width: {
                            xs: '100%',
                            md: 'calc(100% - 62px - 1rem)',
                        },
                        mr: {
                            xs: 0,
                            md: 2,
                        },
                    }}
                >
                    <EditStudyAnalysisIBMA3 />
                    <Box sx={[StudyCBMAPageStyles.loadingButtonContainer]}>
                        <Box sx={{ width: '20%', justifyContent: 'flex-start' }}>
                            <ConfirmationDialog
                                isOpen={confirmationDialogIsOpen}
                                dialogTitle="You have unsaved changes"
                                dialogMessage="Are you sure you want to continue? You'll lose your unsaved changes"
                                onCloseDialog={handleCloseConfirmationDialog}
                                rejectText="Cancel"
                                confirmText="Continue"
                            />
                            <Button
                                color="secondary"
                                disableElevation
                                size="small"
                                sx={{ width: mdDown ? '40px' : '160px' }}
                                variant="contained"
                                onClick={handleBackToExtraction}
                            >
                                {mdDown ? <ArrowBack /> : 'Back to extraction'}
                            </Button>
                        </Box>
                        <Box
                            sx={{
                                width: '60%',
                                display: 'flex',
                                justifyContent: 'center',
                            }}
                        >
                            <DisplayExtractionTableState />
                        </Box>
                        <Box sx={{ width: '20%', display: 'flex', justifyContent: 'flex-end' }}>
                            <EditStudyCompleteButton />
                        </Box>
                    </Box>
                </Box>
                <Box
                    sx={{
                        position: 'sticky', // this is needed when the toolbar is on top of the edit study content
                        top: '0',
                        zIndex: 999,
                        mb: 1,
                    }}
                >
                    {/* <EditStudyToolbar /> */}
                </Box>
            </Box>
        </StateHandlerComponent>
    );
};

export default StudyIBMAPage;
