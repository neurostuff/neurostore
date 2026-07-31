import { Button, ButtonProps } from '@mui/material';
import ConfirmationDialog from 'components/Dialogs/ConfirmationDialog';
import { usePromoteAllUncategorized } from 'stores/projects/ProjectStore';
import { useState } from 'react';

const CurationPromoteUncategorizedButton = ({
    dialogTitle,
    dialogMessage,
    onComplete,
    ...props
}: ButtonProps & { dialogTitle: string; dialogMessage: string; onComplete?: () => void }) => {
    const [skipCurationDialogIsOpen, setSkipCurationDialogIsOpen] = useState(false);
    const promoteAllUncategorized = usePromoteAllUncategorized();

    const handleSkipCuration = (confirm?: boolean) => {
        if (confirm) {
            promoteAllUncategorized();
            if (onComplete) onComplete();
        }

        setSkipCurationDialogIsOpen(false);
    };

    return (
        <>
            <ConfirmationDialog
                isOpen={skipCurationDialogIsOpen}
                onCloseDialog={handleSkipCuration}
                dialogTitle={dialogTitle}
                rejectText="Cancel"
                confirmText="Continue"
                dialogMessage={dialogMessage}
            />
            <Button {...props} onClick={() => setSkipCurationDialogIsOpen(true)}>
                {props.children}
            </Button>
        </>
    );
};

export default CurationPromoteUncategorizedButton;
