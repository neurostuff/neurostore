import { Box, TextField, Typography } from '@mui/material';
import { IDynamicFormInput } from './DynamicForm';

const DynamicFormNumericInput: React.FC<IDynamicFormInput> = (props) => {
    return (
        <Box sx={{ marginBottom: '2rem' }}>
            <Typography variant="h6">{props.parameterName}</Typography>
            <Typography sx={{ marginBottom: '1rem' }} variant="subtitle2">
                {props.value.description}
            </Typography>

            <Box sx={{ width: '50%' }}>
                <TextField sx={{ width: '100%' }} type="number" />
            </Box>
        </Box>
    );
};

export default DynamicFormNumericInput;
