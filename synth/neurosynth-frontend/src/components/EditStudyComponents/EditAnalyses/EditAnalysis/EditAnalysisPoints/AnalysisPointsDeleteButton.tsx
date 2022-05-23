import { Button } from '@mui/material';
import ConfirmationDialog from 'components/Dialogs/ConfirmationDialog/ConfirmationDialog';
import { useState } from 'react';

const AnalysisPointsDeleteButton: React.FC<{
    pointId: string | undefined;
    onDelete: (id: string) => void;
}> = (props) => {
    const [dialogIsOpen, setDialogIsOpen] = useState(false);

    return (
        <>
            <ConfirmationDialog
                isOpen={dialogIsOpen}
                confirmText="yes"
                rejectText="no"
                dialogTitle="Are you sure you want to delete this point?"
                onCloseDialog={(confirmed) => {
                    if (confirmed) props.onDelete(props.pointId || '');
                    setDialogIsOpen(false);
                }}
            />
            <Button color="error" variant="text" onClick={() => setDialogIsOpen(true)}>
                delete
            </Button>
        </>
    );
};

export default AnalysisPointsDeleteButton;
