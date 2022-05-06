import { Box, Typography, Switch, Stack, ToggleButtonGroup, ToggleButton } from '@mui/material';
import { IDynamicFormInput } from '../..';
import MetaAnalysisAlgorithmStyles from '../MetaAnalysisAlgorithm.styles';

const DynamicFormBoolInput: React.FC<IDynamicFormInput> = (props) => {
    return (
        <Box sx={MetaAnalysisAlgorithmStyles.input}>
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                {props.parameterName}
            </Typography>
            <Typography sx={{ marginBottom: '1rem' }} variant="subtitle2">
                {props.parameter.description}
            </Typography>

            <ToggleButtonGroup
                exclusive
                color={!!props.value ? 'primary' : 'secondary'}
                value={props.value || false}
                onChange={(_event, newVal: boolean) => {
                    if (newVal !== null && newVal !== undefined)
                        props.onUpdate({
                            [props.parameterName]: newVal,
                        });
                }}
            >
                <ToggleButton value={true}>true</ToggleButton>
                <ToggleButton value={false}>false</ToggleButton>
            </ToggleButtonGroup>
        </Box>
    );
};

export default DynamicFormBoolInput;
