import {
    Box,
    Button,
    ButtonProps,
    Dialog,
    DialogContent,
    DialogContentText,
    DialogTitle,
    IconButton,
    Typography,
} from '@mui/material';
import { Close } from '@mui/icons-material';
import LoadingButton from 'components/Buttons/LoadingButton';
import { ColorOptions } from 'index';
import { ReactNode, useMemo } from 'react';

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

const ConfirmationDialog = (props: IConfirmationDialog) => {
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
                        <Close sx={{ fontSize: '2rem' }} />
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
