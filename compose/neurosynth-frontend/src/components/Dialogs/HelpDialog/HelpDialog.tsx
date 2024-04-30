import HelpIcon from '@mui/icons-material/Help';
import { IconButton } from '@mui/material';
import React, { useState } from 'react';
import BaseDialog from '../BaseDialog';

const HelpDialog: React.FC<{ dialogTitle: string }> = (props) => {
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
            </BaseDialog>
        </>
    );
};

export default HelpDialog;
