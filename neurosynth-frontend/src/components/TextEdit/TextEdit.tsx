import { IconButton, TextField, Theme, Button } from '@mui/material';
import { Box, SxProps } from '@mui/system';
import { useEffect, useState } from 'react';
import EditIcon from '@mui/icons-material/Edit';

export interface ITextEdit {
    textToEdit: string;
    sx?: SxProps<Theme>;
    multiline?: boolean;
    placeholder?: string;
    label?: string;
    onSave: (updatedText: string) => void;
}

const TextEdit: React.FC<ITextEdit> = (props) => {
    const [editMode, setEditMode] = useState(false);
    const [editedValue, setEditedValue] = useState(props.textToEdit);

    useEffect(() => {
        setEditedValue(props.textToEdit);
    }, [props.textToEdit]);

    return (
        <>
            {editMode ? (
                <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                    <TextField
                        variant="standard"
                        multiline={!!props.multiline}
                        value={editedValue}
                        label={props.label || ''}
                        placeholder={props.placeholder || ''}
                        onChange={(event) => {
                            setEditedValue(event.target.value);
                        }}
                        sx={{
                            '.MuiInputBase-root': { ...props.sx },
                            '.MuiInputLabel-root': { ...props.sx },
                        }}
                    />
                    <Box>
                        <Button
                            onClick={() => {
                                props.onSave(editedValue);
                                setEditMode(false);
                            }}
                        >
                            Save
                        </Button>
                        <Button
                            onClick={() => {
                                setEditedValue(props.textToEdit);
                                setEditMode(false);
                            }}
                            color="secondary"
                        >
                            Cancel
                        </Button>
                    </Box>
                </Box>
            ) : (
                <Box sx={{ display: 'flex', flexDirection: 'row' }}>
                    {props.children}
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <IconButton
                            sx={{ margin: '0 5px' }}
                            onClick={() => {
                                setEditMode(true);
                            }}
                        >
                            <EditIcon sx={{ fontSize: '1.5rem' }} color="primary" />
                        </IconButton>
                    </Box>
                </Box>
            )}
        </>
    );
};

export default TextEdit;
