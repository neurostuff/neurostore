import { Button, ButtonProps } from '@mui/material';
import ConfirmationDialog from 'components/Dialogs/ConfirmationDialog';
import { usePromoteAllUncategorized } from 'pages/Project/store/ProjectStore';
import { useState } from 'react';

const CurationPromoteUncategorizedButton: React.FC<ButtonProps & { dialogTitle: string; dialogMessage: string }> = ({
    dialogTitle,
    dialogMessage,
    ...props
}) => {
    const [skipCurationDialogIsOpen, setSkipCurationDialogIsOpen] = useState(false);
    const promoteAllUncategorized = usePromoteAllUncategorized();

    const handleSkipCuration = (confirm?: boolean) => {
        if (confirm) {
            promoteAllUncategorized();
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
