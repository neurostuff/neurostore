import { Box, TextField } from '@mui/material';
import { IDynamicFormInput } from 'pages/MetaAnalysis/components/DynamicForm.types';
import MetaAnalysisDynamicFormTitle from './MetaAnalysisDynamicFormTitle';
import DynamicFormStyles from 'pages/MetaAnalysis/components//DynamicFormStyles';

const DynamicFormNumericInput: React.FC<IDynamicFormInput> = (props) => {
    return (
        <Box sx={DynamicFormStyles.input}>
            <MetaAnalysisDynamicFormTitle
                name={props.parameterName}
                description={props.parameter.description}
            />

            <Box sx={{ width: '50%' }}>
                <TextField
                    onWheel={(event) => {
                        event.preventDefault();
                    }}
                    onChange={(event) => {
                        const parsedValue = parseFloat(event.target.value);
                        if (event.target.value === '') {
                            props.onUpdate({
                                [props.parameterName]: null,
                            });
                        } else if (isNaN(parsedValue)) {
                            return;
                        } else {
                            props.onUpdate({
                                [props.parameterName]: parsedValue,
                            });
                        }
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
