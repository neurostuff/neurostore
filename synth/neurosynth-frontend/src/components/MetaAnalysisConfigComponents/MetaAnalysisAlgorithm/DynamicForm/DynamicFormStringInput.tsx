import { Box, Typography, TextField } from '@mui/material';
import { IDynamicFormInput } from './DynamicForm';

const DynamicFormStringInput: React.FC<IDynamicFormInput> = (props) => {
    return (
        <Box sx={{ marginBottom: '2.5rem' }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                {props.parameterName}
            </Typography>
            <Typography sx={{ marginBottom: '1rem' }} variant="subtitle2">
                {props.value.description}
            </Typography>

            <Box sx={{ width: '50%' }}>
                <TextField label="text" sx={{ width: '100%' }} type="text" />
            </Box>
        </Box>
    );
};

export default DynamicFormStringInput;
