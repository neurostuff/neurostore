import { Dialog, DialogContent, DialogTitle, Box, Typography, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

export interface IBaseDialog {
    isOpen: boolean;
    dialogTitle: string;
    onCloseDialog: () => void;
}

const BaseDialog: React.FC<IBaseDialog> = (props) => {
    const handleCloseDialog = () => {
        props.onCloseDialog();
    };

    return (
        <Dialog open={props.isOpen} onClose={handleCloseDialog}>
            <DialogTitle sx={{ display: 'flex' }}>
                <Box sx={{ display: 'flex', flexGrow: 1, alignItems: 'center' }}>
                    <Typography variant="h6">{props.dialogTitle}</Typography>
                </Box>
                <Box sx={{ display: 'flex' }}>
                    <IconButton onClick={handleCloseDialog}>
                        <CloseIcon sx={{ fontSize: '2rem' }} />
                    </IconButton>
                </Box>
            </DialogTitle>
            <DialogContent>{props.children}</DialogContent>
        </Dialog>
    );
};

export default BaseDialog;
