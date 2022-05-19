import {
    Box,
    Button,
    Dialog,
    DialogContent,
    DialogContentText,
    DialogTitle,
    Typography,
    IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

export interface IConfirmationDialog {
    isOpen: boolean;
    onCloseDialog: (confirm: boolean | undefined) => void;
    dialogTitle: string;
    dialogMessage?: string;
    confirmText?: string;
    rejectText?: string;
}

const ConfirmationDialog: React.FC<IConfirmationDialog> = (props) => {
    return (
        <Dialog open={props.isOpen} onClose={() => props.onCloseDialog(undefined)}>
            <DialogTitle sx={{ display: 'flex' }}>
                <Box sx={{ display: 'flex', flexGrow: 1, alignItems: 'center' }}>
                    <Typography variant="h6">{props.dialogTitle}</Typography>
                </Box>
                <Box sx={{ display: 'flex' }}>
                    <IconButton onClick={() => props.onCloseDialog(undefined)}>
                        <CloseIcon sx={{ fontSize: '2rem' }} />
                    </IconButton>
                </Box>
            </DialogTitle>
            <DialogContent>
                {props.dialogMessage && (
                    <DialogContentText sx={{ marginBottom: '1rem' }}>
                        {props.dialogMessage}
                    </DialogContentText>
                )}
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Button
                        sx={{ width: '250px', marginRight: '15px' }}
                        onClick={() => props.onCloseDialog(true)}
                        variant="contained"
                        color="success"
                    >
                        {props.confirmText ? props.confirmText : 'Confirm'}
                    </Button>
                    <Button
                        sx={{ width: '250px' }}
                        onClick={() => props.onCloseDialog(false)}
                        variant="contained"
                        color="error"
                    >
                        {props.rejectText ? props.rejectText : 'Reject'}
                    </Button>
                </Box>
            </DialogContent>
        </Dialog>
    );
};

export default ConfirmationDialog;
