import { Box } from '@mui/material';
import BaseDialog, { IDialog } from 'components/Dialogs/BaseDialog';

const PubmedImportDialog: React.FC<Omit<IDialog, 'dialogTitle'>> = (props) => {
    return (
        <BaseDialog
            onCloseDialog={props.onCloseDialog}
            isOpen={props.isOpen}
            dialogTitle="Import PubMed Studies"
        >
            <Box></Box>
        </BaseDialog>
    );
};

export default PubmedImportDialog;
