import { Button, ButtonOwnProps } from '@mui/material';
import ConfirmationDialog from 'components/Dialogs/ConfirmationDialog';
import { useDeleteAnalysis } from 'pages/Study/store/StudyStore';
import { useState } from 'react';
import { useDeleteAnnotationNote } from 'stores/AnnotationStore.actions';

const EditStudyAnalysisDeleteButton: React.FC<
    ButtonOwnProps & {
        analysisId?: string;
        onDeleteAnalysis: () => void;
    }
> = ({ analysisId, onDeleteAnalysis, ...buttonProps }) => {
    const deleteAnalysis = useDeleteAnalysis();
    const deleteAnnotationNote = useDeleteAnnotationNote();

    const [dialogIsOpen, setDialogIsOpen] = useState(false);

    const handleCloseDialog = (confirm?: boolean) => {
        if (confirm && analysisId) {
            deleteAnalysis(analysisId);
            deleteAnnotationNote(analysisId);
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

export default EditStudyAnalysisDeleteButton;
