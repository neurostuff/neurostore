import Chip, { ChipProps } from '@mui/material/Chip';
import ConfirmationDialog from 'components/Dialogs/ConfirmationDialog';
import ProgressLoader from 'components/ProgressLoader';
import { useState } from 'react';

const NeurosynthConfirmationChip: React.FC<ChipProps & { isLoading?: boolean }> = (props) => {
    const { isLoading, ...chipProps } = props;

    const [confirmationDialogIsOpen, setConfirmationDialogIsOpen] = useState(false);

    const handleDelete = () => {
        setConfirmationDialogIsOpen(true);
    };

    const handleCloseDialog = (confirm: boolean | undefined, _data: any) => {
        if (confirm && props.onDelete) {
            props.onDelete(undefined);
        }
        setConfirmationDialogIsOpen(false);
    };

    return (
        <>
            <ConfirmationDialog
                dialogMessage={props.label?.toString() || ''}
                dialogTitle="Are you sure you want to remove this tag?"
                confirmText="confirm"
                rejectText="cancel"
                onCloseDialog={handleCloseDialog}
                isOpen={confirmationDialogIsOpen}
            />
            <Chip
                {...chipProps}
                onDelete={handleDelete}
                deleteIcon={props.isLoading ? <ProgressLoader size={18} /> : props.deleteIcon}
            />
        </>
    );
};

export default NeurosynthConfirmationChip;
