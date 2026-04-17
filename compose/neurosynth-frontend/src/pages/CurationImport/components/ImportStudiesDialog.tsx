import BaseDialog, { IDialog } from 'components/Dialogs/BaseDialog';
import Import from './Import';
import { EImportMode } from '../CurationImport.types';
import { Box } from '@mui/material';

const ImportStudiesDialog: React.FC<IDialog & { method: EImportMode | undefined }> = ({
    isOpen,
    onCloseDialog,
    method,
}) => {
    return (
        <BaseDialog isOpen={isOpen} dialogTitle="Import Studies" onCloseDialog={onCloseDialog} maxWidth="lg" fullWidth>
            <Box
                sx={{
                    padding: '2rem',
                }}
            >
                {method && <Import method={method} onClose={onCloseDialog} />}
            </Box>
        </BaseDialog>
    );
};

export default ImportStudiesDialog;
