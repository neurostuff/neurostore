import { Box } from '@mui/material';
import BaseDialog, { IBaseDialog } from 'components/Dialogs/BaseDialog';

const PubmedImportDialog: React.FC<Omit<IBaseDialog, 'dialogTitle'>> = (props) => {
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
