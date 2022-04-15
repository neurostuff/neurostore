import { Box, Typography } from '@mui/material';
import { IDynamicFormInput } from './DynamicForm';

const DynamicFormBoolInput: React.FC<IDynamicFormInput> = (props) => {
    return (
        <Box>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                {props.parameterName}
            </Typography>
            <Typography sx={{ marginBottom: '1rem' }} variant="subtitle2">
                {props.value.description}
            </Typography>
        </Box>
    );
};

export default DynamicFormBoolInput;
