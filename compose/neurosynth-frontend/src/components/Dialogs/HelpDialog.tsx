import HelpIcon from '@mui/icons-material/Help';
import { Button, IconButton } from '@mui/material';
import React, { useState } from 'react';
import BaseDialog from './BaseDialog';

const HelpDialog = (props: { dialogTitle: string;
    children?: React.ReactNode}) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <>
            <IconButton color="primary" onClick={() => setIsOpen(true)}>
                <HelpIcon />
            </IconButton>
            <BaseDialog
                dialogTitle={props.dialogTitle}
                isOpen={isOpen}
                fullWidth
                maxWidth="md"
                onCloseDialog={() => setIsOpen(false)}
            >
                {props.children}

                <Button
                    onClick={() => setIsOpen(false)}
                    variant="contained"
                    disableElevation
                    sx={{ marginTop: '1rem' }}
                >
                    Close
                </Button>
            </BaseDialog>
        </>
    );
};

export default HelpDialog;
