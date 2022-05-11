import { Box, TextField } from '@mui/material';
import MetaAnalysisAlgorithmStyles from '../MetaAnalysisAlgorithm.styles';
import { IDynamicFormInput } from '../..';
import DynamicFormBaseTitle from './DynamicFormBaseTitle';

const DynamicFormNumericInput: React.FC<IDynamicFormInput> = (props) => {
    return (
        <Box sx={MetaAnalysisAlgorithmStyles.input}>
            <DynamicFormBaseTitle
                name={props.parameterName}
                description={props.parameter.description}
            />

            <Box sx={{ width: '50%' }}>
                <TextField
                    onChange={(event) => {
                        props.onUpdate({
                            [props.parameterName]: event.target.value,
                        });
                    }}
                    value={props.value || ''}
                    label="number"
                    sx={{ width: '100%' }}
                    type="number"
                />
            </Box>
        </Box>
    );
};

export default DynamicFormNumericInput;
