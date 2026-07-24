import { Close } from '@mui/icons-material';
import { Box, Breakpoint, Dialog, DialogContent, DialogTitle, IconButton, Typography } from '@mui/material';
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
    children?: React.ReactNode;
}

const BaseDialog = (props: IBaseDialog) => {
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
                        <Close sx={{ fontSize: '2rem' }} />
                    </IconButton>
                </Box>
            </DialogTitle>
            <DialogContent sx={props.dialogContentSx}>{props.children}</DialogContent>
        </Dialog>
    );
};

export default BaseDialog;
