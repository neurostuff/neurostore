import { Box, Button } from '@mui/material';
import ConfirmationDialog from 'components/Dialogs/ConfirmationDialog';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import { hasUnsavedStudyChanges, unsetUnloadHandler } from 'helpers/BeforeUnload.helpers';
import { useProjectExtractionAnnotationId } from 'pages/Project/store/ProjectStore';
import EditStudyAnalyses from 'pages/Study/components/EditStudyAnalyses';
import EditStudyAnnotations from 'pages/Study/components/EditStudyAnnotations';
import EditStudyDetails from 'pages/Study/components/EditStudyDetails';
import EditStudyMetadata from 'pages/Study/components/EditStudyMetadata';
import EditStudyPageHeader from 'pages/Study/components/EditStudyPageHeader';
import EditStudyPageStyles from 'pages/Study/EditStudyPage.styles';
import { useClearStudyStore, useGetStudyIsLoading, useInitStudyStore, useStudyId } from 'pages/Study/store/StudyStore';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useClearAnnotationStore, useInitAnnotationStore } from 'stores/AnnotationStore.actions';
import { useAnnotationId, useGetAnnotationIsLoading } from 'stores/AnnotationStore.getters';
import DisplayExtractionTableState from './components/DisplayExtractionTableState';
import EditStudyCompleteButton from './components/EditStudyCompleteButton';

const EditStudyPage: React.FC = (props) => {
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
            <Box>
                <EditStudyPageHeader />
                <EditStudyAnnotations />
                <EditStudyAnalyses />
                <EditStudyDetails />
                <Box sx={{ marginBottom: '5rem' }}>
                    <EditStudyMetadata />
                </Box>
                <Box sx={[EditStudyPageStyles.loadingButtonContainer]}>
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
                            sx={{ width: '160px' }}
                            variant="contained"
                            onClick={handleBackToExtraction}
                        >
                            Back to extraction
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
        </StateHandlerComponent>
    );
};

export default EditStudyPage;
