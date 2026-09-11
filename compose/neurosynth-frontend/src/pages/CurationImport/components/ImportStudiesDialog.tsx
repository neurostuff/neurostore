import BaseDialog, { IDialog } from 'components/Dialogs/BaseDialog';
import { EImportMode } from 'pages/Curation/Curation.types';
import Import from './Import';

const ImportStudiesDialog = ({ isOpen, onCloseDialog, method }: IDialog & { method: EImportMode | undefined }) => {
    return (
        <BaseDialog
            dialogTitleSx={{ px: '3rem !important' }}
            dialogContentSx={{ px: '3rem !important' }}
            isOpen={isOpen}
            dialogTitle="Import Studies"
            onCloseDialog={onCloseDialog}
            maxWidth="md"
            fullWidth
        >
            {method && <Import method={method} onClose={onCloseDialog} />}
        </BaseDialog>
    );
};

export default ImportStudiesDialog;
