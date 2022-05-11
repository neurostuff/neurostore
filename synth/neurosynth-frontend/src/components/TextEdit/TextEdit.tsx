import { IconButton, TextField, Button, CircularProgress } from '@mui/material';
import { Box, SystemStyleObject } from '@mui/system';
import React, { useEffect, useState } from 'react';
import EditIcon from '@mui/icons-material/Edit';
import { useAuth0 } from '@auth0/auth0-react';

export interface ITextEdit {
    textToEdit: string;
    sx?: SystemStyleObject;
    multiline?: boolean;
    placeholder?: string;
    label?: string;
    display?: 'row' | 'column-reverse';
    onSave: (updatedText: string, label: string) => Promise<any> | void;
}

const TextEdit: React.FC<ITextEdit> = (props) => {
    const { isAuthenticated } = useAuth0();

    const {
        textToEdit = '',
        sx = {},
        multiline = false,
        placeholder = '',
        label = '',
        display = 'row',
        onSave = (updatedText: string, label: string) => Promise.resolve(),
        children,
    } = props;

    const [editMode, setEditMode] = useState(false);
    const [editedValue, setEditedValue] = useState(textToEdit);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        setEditedValue(textToEdit);
    }, [textToEdit]);

    return (
        <>
            {editMode ? (
                <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                    <TextField
                        variant="standard"
                        multiline={!!multiline}
                        value={editedValue}
                        label={label}
                        placeholder={placeholder}
                        onChange={(event) => {
                            setEditedValue(event.target.value);
                        }}
                        sx={{
                            '.MuiInputBase-root': { ...sx },
                            '.MuiInputLabel-root': { ...sx },
                            maxWidth: '500px',
                        }}
                    />
                    <Box>
                        <Button
                            onClick={async () => {
                                setEditMode(false);
                                setIsLoading(true);
                                await onSave(editedValue, label);
                                setIsLoading(false);
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
            ) : (
                <Box sx={{ display: 'flex', flexDirection: display, alignItems: 'center' }}>
                    {children}
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        {isLoading ? (
                            <CircularProgress
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
                                    display: isAuthenticated ? 'inline' : 'none',
                                }}
                                disabled={!isAuthenticated}
                                onClick={() => {
                                    setEditMode(true);
                                }}
                            >
                                <EditIcon sx={{ fontSize: '20px' }} color="primary" />
                            </IconButton>
                        )}
                    </Box>
                </Box>
            )}
        </>
    );
};

export default TextEdit;
