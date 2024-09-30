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
import React, { useMemo } from 'react';

export interface IConfirmationDialog {
    isOpen: boolean;
    onCloseDialog: (confirm: boolean | undefined, data?: any) => void;
    dialogTitle: string;
    dialogMessage?: JSX.Element | string;
    confirmText?: string;
    rejectText?: string;
    data?: any;
}

const ConfirmationDialog: React.FC<IConfirmationDialog> = (props) => {
    const dialogContent = useMemo(() => {
        if (!props.dialogMessage) return undefined;

        if (typeof props.dialogMessage === 'string') {
            return <DialogContentText>{props.dialogMessage}</DialogContentText>;
        } else {
            return props.dialogMessage;
        }
    }, [props.dialogMessage]);

    return (
        <Dialog open={props.isOpen} onClose={() => props.onCloseDialog(undefined, props.data)}>
            <DialogTitle sx={{ display: 'flex' }}>
                <Box sx={{ display: 'flex', flexGrow: 1, alignItems: 'center' }}>
                    <Typography variant="h6">{props.dialogTitle}</Typography>
                </Box>
                <Box>
                    <IconButton onClick={() => props.onCloseDialog(undefined, props.data)}>
                        <CloseIcon sx={{ fontSize: '2rem' }} />
                    </IconButton>
                </Box>
            </DialogTitle>
            <DialogContent>
                {props.dialogMessage && dialogContent}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
                    <Button
                        sx={{ width: '250px', marginRight: '15px' }}
                        onClick={() => props.onCloseDialog(false, props.data)}
                        variant="text"
                        color="error"
                    >
                        {props.rejectText ? props.rejectText : 'Reject'}
                    </Button>
                    <Button
                        sx={{ width: '250px' }}
                        onClick={() => props.onCloseDialog(true, props.data)}
                        variant="contained"
                        color="primary"
                        disableElevation
                    >
                        {props.confirmText ? props.confirmText : 'Confirm'}
                    </Button>
                </Box>
            </DialogContent>
        </Dialog>
    );
};

export default ConfirmationDialog;
