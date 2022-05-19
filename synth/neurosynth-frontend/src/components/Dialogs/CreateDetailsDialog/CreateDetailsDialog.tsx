import {
    Box,
    Button,
    Dialog,
    DialogContent,
    DialogTitle,
    TextField,
    Typography,
    IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { ChangeEvent, useEffect, useState } from 'react';

export interface ICreateDetailsDialog {
    isOpen: boolean;
    onCreate: (name: string, description: string) => void;
    onCloseDialog: () => void;
    titleText: string;
    initName?: string;
}

const CreateDetailsDialog: React.FC<ICreateDetailsDialog> = (props) => {
    const [hasEnteredText, setHasEnteredText] = useState(false);

    const [newDetails, setDetails] = useState({
        name: '',
        description: '',
    });

    useEffect(() => {
        setDetails({
            name: props.initName || '',
            description: '',
        });
    }, [props.initName]);

    const handleOnChange = (event: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
        setHasEnteredText(true);
        setDetails((prevState) => ({
            ...prevState,
            [event.target.name]: event.target.value,
        }));
    };

    const handleOnClose = () => {
        setHasEnteredText(false);
        setDetails({
            name: '',
            description: '',
        });
        props.onCloseDialog();
    };

    return (
        <Dialog open={props.isOpen} onClose={handleOnClose}>
            <DialogTitle sx={{ display: 'flex' }}>
                <Box sx={{ display: 'flex', flexGrow: 1, alignItems: 'center' }}>
                    <Typography variant="h6">{props.titleText}</Typography>
                </Box>
                <Box sx={{ display: 'flex' }}>
                    <IconButton onClick={() => handleOnClose()}>
                        <CloseIcon sx={{ fontSize: '2rem' }} />
                    </IconButton>
                </Box>
            </DialogTitle>
            <DialogContent>
                <TextField
                    label="Name"
                    value={newDetails.name}
                    name="name"
                    id="dialog-name"
                    error={newDetails.name.length === 0 && hasEnteredText}
                    helperText={
                        newDetails.name.length === 0 && hasEnteredText ? 'name is required' : ''
                    }
                    required
                    onChange={handleOnChange}
                    sx={{ width: '100%', margin: '5px 0 1rem 0' }}
                />
                <TextField
                    label="Description"
                    multiline
                    id="dialog-description"
                    onChange={handleOnChange}
                    name="description"
                    value={newDetails.description}
                    sx={{ width: '100%', margin: '0 0 1.5rem 0' }}
                />
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Button
                        sx={{ width: '150px' }}
                        onClick={() => {
                            props.onCreate(newDetails.name, newDetails.description);
                            handleOnClose();
                        }}
                        variant="contained"
                        disabled={newDetails.name.length === 0}
                    >
                        Create
                    </Button>
                    <Button
                        sx={{ width: '150px' }}
                        onClick={handleOnClose}
                        variant="outlined"
                        color="error"
                    >
                        Cancel
                    </Button>
                </Box>
            </DialogContent>
        </Dialog>
    );
};

export default CreateDetailsDialog;
