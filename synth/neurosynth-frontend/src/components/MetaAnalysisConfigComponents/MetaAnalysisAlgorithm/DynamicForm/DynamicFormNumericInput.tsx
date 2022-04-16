import { Box, TextField } from '@mui/material';
import MetaAnalysisAlgorithmStyles from '../MetaAnalysisAlgorithm.styles';
import { IDynamicFormInput } from './DynamicForm';
import DynamicFormBaseTitle from './DynamicFormBaseTitle';

const DynamicFormNumericInput: React.FC<IDynamicFormInput> = (props) => {
    return (
        <Box sx={MetaAnalysisAlgorithmStyles.input}>
            <DynamicFormBaseTitle
                name={props.parameterName}
                description={props.value.description}
            />

            <Box sx={{ width: '50%' }}>
                <TextField label="number" sx={{ width: '100%' }} type="number" />
            </Box>
        </Box>
    );
};

export default DynamicFormNumericInput;
