import { Button, ButtonProps } from '@mui/material';
import ConfirmationDialog from 'components/Dialogs/ConfirmationDialog';
import { hasUnsavedStudyChanges, unsetUnloadHandler } from 'helpers/BeforeUnload.helpers';
import { useGetExtractionSummary, useUserCanEdit } from 'hooks';
import { IProjectPageLocationState } from 'pages/Project/ProjectPage';
import { useProjectId, useProjectMetaAnalysisCanEdit, useProjectUser } from 'stores/projects/ProjectStore';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';

const StartMetaAnalysisButton: React.FC<ButtonProps> = ({ sx: sxProp, ...restProps }) => {
    const navigate = useNavigate();
    const projectId = useProjectId();
    const projectUser = useProjectUser();
    const canEdit = useUserCanEdit(projectUser ?? undefined);
    const metaAnalysisStepInitialized = useProjectMetaAnalysisCanEdit();
    const { enqueueSnackbar } = useSnackbar();

    const [confirmationDialogIsOpen, setConfirmationDialogIsOpen] = useState(false);

    const extractionSummary = useGetExtractionSummary(projectId);
    const extractionIsComplete = extractionSummary.total > 0 && extractionSummary.completed === extractionSummary.total;

    const startMetaAnalysis = () => {
        if (extractionIsComplete) {
            navigate(`/projects/${projectId}/project`, {
                state: {
                    projectPage: {
                        scrollToMetaAnalysisProceed: true,
                    },
                } as IProjectPageLocationState,
            });
        } else {
            enqueueSnackbar(
                `Extraction is not complete. You still have ${extractionSummary.total - extractionSummary.completed} studies to complete before you can start a meta-analysis.`,
                { variant: 'warning' }
            );
        }
    };

    const handleMoveToComplete = () => {
        const hasUnsavedChanges = hasUnsavedStudyChanges();
        if (hasUnsavedChanges) {
            setConfirmationDialogIsOpen(true);
            return;
        }

        startMetaAnalysis();
    };

    const handleConfirmationDialogClose = (ok: boolean | undefined) => {
        if (!ok) {
            setConfirmationDialogIsOpen(false);
            return;
        }

        unsetUnloadHandler('study');
        unsetUnloadHandler('annotation');
        startMetaAnalysis();
        setConfirmationDialogIsOpen(false);
    };

    return (
        <>
            <ConfirmationDialog
                isOpen={confirmationDialogIsOpen}
                dialogTitle="You have unsaved changes"
                dialogMessage="Are you sure you want to continue? You'll lose your unsaved changes"
                onCloseDialog={handleConfirmationDialogClose}
                rejectText="Cancel"
                confirmText="Continue"
            />
            <Button
                variant={metaAnalysisStepInitialized ? 'contained' : 'text'}
                disabled={!canEdit}
                color="success"
                size="small"
                disableElevation
                onClick={handleMoveToComplete}
                sx={sxProp}
                {...restProps}
            >
                {metaAnalysisStepInitialized ? 'View Meta Analyses' : 'Start Meta Analysis'}
            </Button>
        </>
    );
};

export default StartMetaAnalysisButton;
