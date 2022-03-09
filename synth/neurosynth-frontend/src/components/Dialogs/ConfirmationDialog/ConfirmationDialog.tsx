import { Box, Button, Dialog, DialogContent, DialogTitle } from '@mui/material';

export interface IConfirmationDialog {
    isOpen: boolean;
    onCloseDialog: (confirm: boolean | undefined) => void;
    message: string;
    confirmText?: string;
    rejectText?: string;
}

const ConfirmationDialog: React.FC<IConfirmationDialog> = (props) => {
    return (
        <Dialog open={props.isOpen} onClose={() => props.onCloseDialog(undefined)}>
            <DialogTitle>{props.message}</DialogTitle>
            <DialogContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Button
                        sx={{ width: '150px' }}
                        onClick={() => props.onCloseDialog(true)}
                        variant="contained"
                        color="success"
                    >
                        {props.confirmText ? props.confirmText : 'Confirm'}
                    </Button>
                    <Button
                        sx={{ width: '150px' }}
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
