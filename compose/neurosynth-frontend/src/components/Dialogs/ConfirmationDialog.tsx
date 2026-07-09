import {
    Box,
    Button,
    Dialog,
    DialogContent,
    DialogContentText,
    DialogTitle,
    Typography,
    IconButton,
    ButtonProps,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import React, { ReactNode, useMemo } from 'react';
import LoadingButton from 'components/Buttons/LoadingButton';
import { ColorOptions } from 'index';

export interface IConfirmationDialog {
    isOpen: boolean;
    onCloseDialog: (confirm: boolean | undefined) => void;
    dialogTitle: string;
    dialogMessage?: ReactNode | string;
    confirmText?: string;
    confirmButtonProps?: ButtonProps & { isLoading?: boolean; loaderColor?: ColorOptions };
    rejectButtonProps?: ButtonProps;
    rejectText?: string;
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
        <Dialog open={props.isOpen} onClose={() => props.onCloseDialog(undefined)}>
            <DialogTitle sx={{ display: 'flex' }}>
                <Box sx={{ display: 'flex', flexGrow: 1, alignItems: 'center' }}>
                    <Typography variant="h6">{props.dialogTitle}</Typography>
                </Box>
                <Box>
                    <IconButton onClick={() => props.onCloseDialog(undefined)}>
                        <CloseIcon sx={{ fontSize: '2rem' }} />
                    </IconButton>
                </Box>
            </DialogTitle>
            <DialogContent>
                {props.dialogMessage && dialogContent}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
                    <Button
                        sx={{ width: '250px', marginRight: '15px' }}
                        onClick={() => props.onCloseDialog(false)}
                        variant="text"
                        color="error"
                        {...(props.rejectButtonProps || {})}
                    >
                        {props.rejectText ? props.rejectText : 'Reject'}
                    </Button>
                    <LoadingButton
                        text={props.confirmText || 'Confirm'}
                        loaderColor={props.confirmButtonProps?.loaderColor}
                        isLoading={props.confirmButtonProps?.isLoading}
                        sx={{ width: '250px' }}
                        onClick={() => props.onCloseDialog(true)}
                        variant="contained"
                        color="primary"
                        disableElevation
                        {...(props.confirmButtonProps || {})}
                    />
                </Box>
            </DialogContent>
        </Dialog>
    );
};

export default ConfirmationDialog;
