import { Button, ButtonOwnProps } from '@mui/material';
import ConfirmationDialog from 'components/Dialogs/ConfirmationDialog';
import { useDeleteAnalysis } from 'stores/study/StudyStore';
import { useState } from 'react';
import { useStudyCBMAContext } from 'pages/StudyCBMA/context/StudyCBMAContext';

const EditStudyAnalysisCBMADeleteButton = ({
    analysisId,
    onDeleteAnalysis,
    ...buttonProps
}: ButtonOwnProps & {
    analysisId?: string;
    onDeleteAnalysis: () => void;
}) => {
    const deleteAnalysis = useDeleteAnalysis();
    const { studyAnnotationsTableRef } = useStudyCBMAContext();

    const [dialogIsOpen, setDialogIsOpen] = useState(false);

    const handleCloseDialog = (confirm?: boolean) => {
        if (confirm && analysisId) {
            deleteAnalysis(analysisId);
            studyAnnotationsTableRef.current?.removeAnalysisRow(analysisId);
            onDeleteAnalysis();
        }
        setDialogIsOpen(false);
    };

    return (
        <>
            <ConfirmationDialog
                isOpen={dialogIsOpen}
                dialogTitle="Are you sure you want to delete this analysis?"
                onCloseDialog={handleCloseDialog}
                confirmText="delete analysis"
                rejectText="cancel"
            />
            <Button {...buttonProps} onClick={() => setDialogIsOpen(true)}>
                {buttonProps.children}
            </Button>
        </>
    );
};

export default EditStudyAnalysisCBMADeleteButton;
