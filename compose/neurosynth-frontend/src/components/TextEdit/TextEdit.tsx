import { Box, IconButton, TextField, Button } from '@mui/material';
import { SystemStyleObject } from '@mui/system';
import React, { useEffect, useState } from 'react';
import EditIcon from '@mui/icons-material/Edit';
import { useAuth0 } from '@auth0/auth0-react';
import ProgressLoader from 'components/ProgressLoader';

export interface ITextEdit {
    textToEdit: string;
    sx?: SystemStyleObject;
    textFieldSx?: SystemStyleObject;
    multiline?: boolean;
    fieldName?: string;
    placeholder?: string;
    label?: string;
    display?: 'row' | 'column-reverse';
    isLoading?: boolean;
    editIconIsVisible?: boolean;
    onSave: (updatedText: string, label: string) => void;
}

const TextEdit: React.FC<ITextEdit> = (props) => {
    const { isAuthenticated } = useAuth0();

    const {
        textToEdit = '',
        sx = {},
        textFieldSx = {},
        multiline = false,
        placeholder = '',
        label = '',
        display = 'row',
        isLoading = false,
        onSave = (updatedText: string, label: string) => {},
        children,
        editIconIsVisible = isAuthenticated,
        fieldName = '',
    } = props;

    const [editMode, setEditMode] = useState(false);
    const [editedValue, setEditedValue] = useState(textToEdit);

    useEffect(() => {
        setEditedValue(textToEdit);
    }, [textToEdit]);

    if (editMode) {
        return (
            <Box sx={[{ display: 'flex', flexDirection: 'column' }, sx]}>
                <TextField
                    variant="standard"
                    multiline={!!multiline}
                    value={editedValue}
                    label={label}
                    placeholder={placeholder}
                    onChange={(event) => setEditedValue(event.target.value)}
                    sx={[{ minWidth: '350px' }, textFieldSx]}
                />
                <Box>
                    <Button
                        onClick={async () => {
                            setEditMode(false);
                            onSave(editedValue, fieldName || label);
                        }}
                    >
                        Save
                    </Button>
                    <Button
                        onClick={() => {
                            setEditedValue(textToEdit);
                            setEditMode(false);
                        }}
                        color="secondary"
                    >
                        Cancel
                    </Button>
                </Box>
            </Box>
        );
    }

    return (
        <Box sx={{ display: 'flex', flexDirection: display, alignItems: 'center' }}>
            {children}
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                {isLoading ? (
                    <ProgressLoader
                        sx={{
                            marginLeft: '5px',
                            width: '20px !important',
                            height: '20px !important',
                        }}
                    />
                ) : (
                    <IconButton
                        sx={{
                            width: '32px',
                            height: '32px',
                            padding: '4px',
                            marginLeft: display === 'row' ? '5px' : '0px',
                            display: editIconIsVisible ? 'inline' : 'none',
                        }}
                        onClick={() => setEditMode(true)}
                    >
                        <EditIcon sx={{ fontSize: '20px' }} color="secondary" />
                    </IconButton>
                )}
            </Box>
        </Box>
    );
};

export default TextEdit;
