import { Box, Button, Dialog, DialogContent, DialogTitle, TextField } from '@mui/material';
import { ChangeEvent, useState } from 'react';

export interface ICreateDatasetDialog {
    isOpen: boolean;
    onCreateDataset: (dataset: { name: string; description: string }) => void;
    onCloseDialog: () => void;
}

const CreateDatasetDialog: React.FC<ICreateDatasetDialog> = (props) => {
    const [hasEnteredText, setHasEnteredText] = useState(false);

    const [newDatasetDetails, setNewDatasetDetails] = useState({
        name: '',
        description: '',
    });

    const handleOnChange = (event: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
        setHasEnteredText(true);
        setNewDatasetDetails((prevState) => ({
            ...prevState,
            [event.target.name]: event.target.value,
        }));
    };

    const handleOnClose = () => {
        setHasEnteredText(false);
        setNewDatasetDetails({
            name: '',
            description: '',
        });
        props.onCloseDialog();
    };

    return (
        <Dialog open={props.isOpen} onClose={handleOnClose}>
            <DialogTitle>Create new dataset</DialogTitle>
            <DialogContent>
                <TextField
                    label="Dataset Name"
                    value={newDatasetDetails.name}
                    name="name"
                    id="dialog-dataset-name"
                    error={newDatasetDetails.name.length === 0 && hasEnteredText}
                    helperText={
                        newDatasetDetails.name.length === 0 && hasEnteredText
                            ? 'name is required'
                            : ''
                    }
                    required
                    onChange={handleOnChange}
                    sx={{ width: '100%', margin: '5px 0 1rem 0' }}
                />
                <TextField
                    label="Dataset Description"
                    multiline
                    id="dialog-dataset-description"
                    onChange={handleOnChange}
                    name="description"
                    value={newDatasetDetails.description}
                    sx={{ width: '100%', margin: '0 0 1.5rem 0' }}
                />
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Button
                        sx={{ width: '150px' }}
                        onClick={() => {
                            props.onCreateDataset(newDatasetDetails);
                        }}
                        variant="contained"
                        disabled={newDatasetDetails.name.length === 0}
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

export default CreateDatasetDialog;
