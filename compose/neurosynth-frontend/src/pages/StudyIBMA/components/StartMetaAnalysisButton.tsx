import { Button, ButtonProps } from '@mui/material';
import ConfirmationDialog from 'components/Dialogs/ConfirmationDialog';
import { hasUnsavedStudyChanges, unsetUnloadHandler } from 'helpers/BeforeUnload.helpers';
import { useUserCanEdit } from 'hooks';
import { IProjectPageLocationState } from 'pages/Project/ProjectPage';
import { useProjectId, useProjectMetaAnalysisCanEdit, useProjectUser } from 'pages/Project/store/ProjectStore';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const StartMetaAnalysisButton: React.FC<ButtonProps> = ({ sx: sxProp, ...restProps }) => {
    const navigate = useNavigate();
    const projectId = useProjectId();
    const projectUser = useProjectUser();
    const canEdit = useUserCanEdit(projectUser ?? undefined);
    const metaAnalysisStepInitialized = useProjectMetaAnalysisCanEdit();

    const [confirmationDialogIsOpen, setConfirmationDialogIsOpen] = useState(false);

    const navigateToProjectMetaAnalysis = () => {
        navigate(`/projects/${projectId}/project`, {
            state: {
                projectPage: {
                    scrollToMetaAnalysisProceed: true,
                },
            } as IProjectPageLocationState,
        });
    };

    const handleMoveToComplete = () => {
        const hasUnsavedChanges = hasUnsavedStudyChanges();
        if (hasUnsavedChanges) {
            setConfirmationDialogIsOpen(true);
            return;
        }

        navigateToProjectMetaAnalysis();
    };

    const handleConfirmationDialogClose = (ok: boolean | undefined) => {
        if (!ok) {
            setConfirmationDialogIsOpen(false);
            return;
        }

        unsetUnloadHandler('study');
        unsetUnloadHandler('annotation');
        navigateToProjectMetaAnalysis();
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
