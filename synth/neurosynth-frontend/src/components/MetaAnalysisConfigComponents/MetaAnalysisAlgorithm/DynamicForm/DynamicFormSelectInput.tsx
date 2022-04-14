import { Box, Typography } from '@mui/material';
import { IDynamicFormInput } from './DynamicForm';

const DynamicFormSelectInput: React.FC<IDynamicFormInput> = (props) => {
    return (
        <Box sx={{ marginBottom: '2rem' }}>
            <Typography variant="h6">{props.parameterName}</Typography>
            <Typography sx={{ marginBottom: '1rem' }} variant="subtitle2">
                {props.value.description}
            </Typography>
        </Box>
    );
};

export default DynamicFormSelectInput;
