import { Box, TextField, Typography } from '@mui/material';
import NavigationButtons, {
    ENavigationButton,
} from 'components/Buttons/NavigationButtons/NavigationButtons';
import BaseDialog, { IDialog } from '../BaseDialog';
import { useState } from 'react';

const InputNumberDialog: React.FC<
    IDialog & {
        onInputNumber: (value: number) => void;
        dialogTitle: string;
        dialogDescription: string;
    }
> = (props) => {
    const [val, setVal] = useState<number | undefined>(4);

    const handleButtonClick = (button: ENavigationButton) => {
        if (button === ENavigationButton.PREV) {
            props.onCloseDialog();
        } else {
            if (!val) return;
            props.onInputNumber(val);
        }
    };

    return (
        <BaseDialog
            fullWidth
            maxWidth="xs"
            dialogTitle={props.dialogTitle}
            isOpen={props.isOpen}
            onCloseDialog={props.onCloseDialog}
        >
            <Box>
                <Typography>{props.dialogDescription}</Typography>
                <TextField
                    onWheel={(event) => {
                        event.preventDefault();
                    }}
                    onChange={(event) => {
                        const parsedValue = parseInt(event.target.value);
                        if (event.target.value === '') {
                            setVal(undefined);
                            return;
                        }

                        if (isNaN(parsedValue)) {
                            return;
                        } else {
                            setVal(parsedValue);
                        }
                    }}
                    value={val}
                    label="number"
                    sx={{ width: '100%', margin: '5px 0' }}
                    type="number"
                />
                <Box sx={{ marginTop: '1rem' }}>
                    <NavigationButtons
                        nextButtonDisabled={!val || val === 0}
                        prevButtonStyle="outlined"
                        prevButtonColor="error"
                        prevButtonText="Cancel"
                        nextButtonStyle="contained"
                        nextButtonText="Submit"
                        onButtonClick={handleButtonClick}
                    />
                </Box>
            </Box>
        </BaseDialog>
    );
};

export default InputNumberDialog;
