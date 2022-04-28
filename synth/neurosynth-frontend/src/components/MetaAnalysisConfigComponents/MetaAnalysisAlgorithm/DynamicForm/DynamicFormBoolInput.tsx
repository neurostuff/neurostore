import { Box, Typography, Switch, Stack } from '@mui/material';
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

            <Stack direction="row" spacing={1} alignItems="center">
                <Typography>false</Typography>
                <Switch
                    onChange={(event) => {
                        props.onUpdate({
                            [props.parameterName]: event.target.value,
                        });
                    }}
                    value={props.value || false}
                />
                <Typography>true</Typography>
            </Stack>
        </Box>
    );
};

export default DynamicFormBoolInput;
