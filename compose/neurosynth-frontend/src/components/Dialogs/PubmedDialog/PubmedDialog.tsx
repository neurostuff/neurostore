import Box from '@mui/material/Box';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';
import React from 'react';
import ConfirmationDialog from '../ConfirmationDialog/ConfirmationDialog';
import PubmedIdUploadWizard from './PubmedIdUploadWizard/PubmedIdUploadWizard';
import { IPubmedArticle } from 'hooks/requests/useGetPubmedIDs';

export interface IPubmedDialog {
    onSubmit: (pubmedIds: string[]) => void;
    onClose: () => void;
    isOpen: boolean;
    onUploadPubmedArticles: (articles: IPubmedArticle[]) => void;
}

const PubmedDialog: React.FC<IPubmedDialog> = (props) => {
    const handleClose = (event: any) => {
        props.onClose();
    };

    return (
        <Dialog maxWidth="lg" open={props.isOpen} onClose={handleClose}>
            <ConfirmationDialog
                isOpen={false}
                dialogMessage="If you exit, all progress will be lost."
                onCloseDialog={(event) => {}}
                rejectText="Cancel"
                dialogTitle="Are you sure you want to exit?"
            />
            <DialogTitle sx={{ width: '600px' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', flexGrow: 1 }}>
                        <Typography alignSelf="center" variant="h6">
                            Upload PubMed IDs
                        </Typography>
                    </Box>
                    <Box>
                        <IconButton onClick={handleClose}>
                            <CloseIcon sx={{ fontSize: '2rem' }} />
                        </IconButton>
                    </Box>
                </Box>
            </DialogTitle>
            <DialogContent>
                <PubmedIdUploadWizard
                    onUploadIds={props.onUploadPubmedArticles}
                    onClose={handleClose}
                />
            </DialogContent>
        </Dialog>
    );
};

export default PubmedDialog;
