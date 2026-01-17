import { Dialog, DialogContent, DialogTitle, Box, Typography, IconButton, Breakpoint } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { SystemStyleObject } from '@mui/system';

export interface IDialog extends Omit<IBaseDialog, 'dialogTitle' | 'fullWidth' | 'maxWidth'> {}

interface IBaseDialog {
    isOpen: boolean;
    dialogTitle: string;
    fullWidth?: boolean;
    maxWidth?: Breakpoint;
    dialogTitleSx?: SystemStyleObject;
    dialogContentSx?: SystemStyleObject;
    onCloseDialog: () => void;
}

const BaseDialog: React.FC<IBaseDialog> = (props) => {
    const handleCloseDialog = () => {
        props.onCloseDialog();
    };

    return (
        <Dialog fullWidth={props.fullWidth} maxWidth={props.maxWidth} open={props.isOpen} onClose={handleCloseDialog}>
            <DialogTitle sx={[{ display: 'flex' }, props.dialogTitleSx || {}]}>
                <Box sx={{ display: 'flex', flexGrow: 1, alignItems: 'center' }}>
                    <Typography variant="h6">{props.dialogTitle}</Typography>
                </Box>
                <Box sx={{ display: 'flex' }}>
                    <IconButton onClick={handleCloseDialog}>
                        <CloseIcon sx={{ fontSize: '2rem' }} />
                    </IconButton>
                </Box>
            </DialogTitle>
            <DialogContent sx={props.dialogContentSx}>{props.children}</DialogContent>
        </Dialog>
    );
};

export default BaseDialog;
