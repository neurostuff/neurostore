import { Box, TextField } from '@mui/material';
import { IDynamicFormInput } from 'pages/MetaAnalysis/components/DynamicForm.types';
import MetaAnalysisDynamicFormTitle from './MetaAnalysisDynamicFormTitle';
import DynamicFormStyles from 'pages/MetaAnalysis/components//DynamicFormStyles';

const DynamicFormStringInput: React.FC<IDynamicFormInput> = (props) => {
    return (
        <Box sx={DynamicFormStyles.input}>
            <MetaAnalysisDynamicFormTitle
                name={props.parameterName}
                description={props.parameter.description}
            />

            <Box sx={{ width: '50%' }}>
                <TextField
                    value={props.value || ''}
                    label="text"
                    sx={{ width: '100%' }}
                    type="text"
                    onChange={(event) => {
                        props.onUpdate({
                            [props.parameterName]: event.target.value,
                        });
                    }}
                />
            </Box>
        </Box>
    );
};

export default DynamicFormStringInput;
