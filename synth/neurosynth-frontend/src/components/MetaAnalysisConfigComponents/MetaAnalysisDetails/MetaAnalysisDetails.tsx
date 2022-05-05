import { TextField, Box, Typography } from '@mui/material';
import { IMetaAnalysisDetails } from '..';
import { NavigationButtons } from '../..';
import { useInputValidation } from '../../../hooks';

const MetaAnalysisDetails: React.FC<IMetaAnalysisDetails> = (props) => {
    const { handleChange, handleOnBlur, handleOnFocus, isValid } = useInputValidation(
        props.metaAnalysisName,
        (arg: string | undefined | null) => !!arg
    );

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            <Typography sx={{ marginBottom: '1rem' }}>
                Enter the <b>name</b> that you would like to use for your meta-analysis
            </Typography>
            <TextField
                sx={{
                    marginBottom: '1rem',
                    width: '50%',
                }}
                variant="outlined"
                label="meta-analysis name"
                required
                onBlur={handleOnBlur}
                onFocus={handleOnFocus}
                error={!isValid}
                value={props.metaAnalysisName || ''}
                helperText={!isValid ? 'this is required' : ''}
                name="name"
                onChange={(event) => {
                    const input = event.target.value as string;
                    handleChange(input);
                    props.onUpdate({ metaAnalysisName: input });
                }}
            />
            <Typography sx={{ marginBottom: '1rem' }}>
                Enter the <b>description</b> that you would like to use for your meta-analysis
            </Typography>
            <TextField
                sx={{
                    marginBottom: '2rem',
                    width: '50%',
                }}
                variant="outlined"
                label="meta-analysis description"
                value={props.metaAnalysisDescription || ''}
                name="description"
                multiline
                onChange={(event) => {
                    const input = event.target.value as string;
                    props.onUpdate({ metaAnalysisDescription: input });
                }}
            />

            <NavigationButtons
                onButtonClick={props.onNext}
                prevButtonDisabled={true}
                nextButtonDisabled={!props.metaAnalysisName}
                nextButtonStyle="outlined"
            />
        </Box>
    );
};

export default MetaAnalysisDetails;
