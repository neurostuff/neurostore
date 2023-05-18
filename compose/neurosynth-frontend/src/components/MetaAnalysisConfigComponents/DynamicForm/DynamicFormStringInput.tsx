import { Box, TextField } from '@mui/material';
import { IDynamicFormInput } from 'components/MetaAnalysisConfigComponents/index';
import DynamicFormBaseTitle from './DynamicFormBaseTitle';
import DynamicFormStyles from './DynamicFormStyles';

const DynamicFormStringInput: React.FC<IDynamicFormInput> = (props) => {
    return (
        <Box sx={DynamicFormStyles.input}>
            <DynamicFormBaseTitle
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
