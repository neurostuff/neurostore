import {
    Box,
    Button,
    Divider,
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    TextField,
    Typography,
} from '@mui/material';
import LoadingButton from 'components/Buttons/LoadingButton/LoadingButton';
import { useEffect, useRef, useState } from 'react';
import BaseDialog, { IDialog } from '../BaseDialog';
import CreateCurationBoardDialogStyles from './CreateCurationBoardDialog.styles';

const CreateCurationBoardDialog: React.FC<
    IDialog & { onCreateCurationBoard: (arg: string[]) => void; createButtonIsLoading: boolean }
> = (props) => {
    const [numColumns, setNumColumns] = useState<number>(4);
    const itemsRef = useRef<HTMLInputElement[]>([]);

    useEffect(() => {
        if (itemsRef.current) {
            itemsRef.current = itemsRef.current.slice(0, numColumns);
        }
    }, [numColumns]);

    const handleCreateCurationBoard = () => {
        if (itemsRef.current) {
            const columns: string[] = itemsRef.current.map((itemRef) => itemRef.value);
            props.onCreateCurationBoard(columns);
        }
    };

    return (
        <BaseDialog
            onCloseDialog={props.onCloseDialog}
            isOpen={props.isOpen}
            maxWidth="lg"
            fullWidth
            dialogTitle="Specify Curation Columns"
        >
            <Box sx={{ margin: '1rem 0' }}>
                <FormControl fullWidth>
                    <InputLabel id="num-col-label">Number of Columns</InputLabel>
                    <Select
                        label="number of columns"
                        value={numColumns}
                        onChange={(event) => {
                            setNumColumns(event.target.value as number);
                        }}
                    >
                        <MenuItem value={1}>1</MenuItem>
                        <MenuItem value={2}>2</MenuItem>
                        <MenuItem value={3}>3</MenuItem>
                        <MenuItem value={4}>4</MenuItem>
                        <MenuItem value={5}>5</MenuItem>
                        <MenuItem value={6}>6</MenuItem>
                        <MenuItem value={7}>7</MenuItem>
                        <MenuItem value={8}>8</MenuItem>
                    </Select>
                </FormControl>

                <Divider sx={{ margin: '2rem 0' }} />

                <Box sx={{ display: 'flex' }}>
                    {numColumns === 0 ? (
                        <Typography sx={{ color: 'warning.dark' }}>
                            No column num specified
                        </Typography>
                    ) : (
                        Array.from(Array(numColumns)).map((_, index) => (
                            <Box
                                key={index}
                                sx={{
                                    flexGrow: 1,
                                    justifyContent: 'center',
                                    display: 'flex',
                                }}
                            >
                                <Box sx={[CreateCurationBoardDialogStyles.mockColumn]}>
                                    <TextField
                                        inputRef={(el) =>
                                            (itemsRef.current[index] = el as HTMLInputElement)
                                        }
                                        sx={{ marginBottom: '0.5rem' }}
                                        size="small"
                                        label={`Column ${index + 1}`}
                                        required
                                        fullWidth
                                    />
                                    <Box sx={CreateCurationBoardDialogStyles.mockStubStudy}></Box>
                                    <Box sx={CreateCurationBoardDialogStyles.mockStubStudy}></Box>
                                    <Box sx={CreateCurationBoardDialogStyles.mockStubStudy}></Box>
                                    <Box sx={CreateCurationBoardDialogStyles.mockStubStudy}></Box>
                                </Box>
                            </Box>
                        ))
                    )}
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem' }}>
                    <Button onClick={() => props.onCloseDialog()} color="error">
                        cancel
                    </Button>
                    <LoadingButton
                        onClick={handleCreateCurationBoard}
                        color="primary"
                        isLoading={props.createButtonIsLoading}
                        variant="contained"
                        text="create"
                        loaderColor="secondary"
                        sx={{ width: '85px' }}
                    />
                </Box>
            </Box>
        </BaseDialog>
    );
};

export default CreateCurationBoardDialog;
