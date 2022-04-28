import { TextField, Box, Typography } from '@mui/material';
import { IMetaAnalysisDetails } from '..';
import { NavigationButtons } from '../..';

const MetaAnalysisDetails: React.FC<IMetaAnalysisDetails> = (props) => {
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
                label="Meta-analysis name"
                value={props.metaAnalysisName}
                name="name"
                onChange={(event) => {
                    const input = event.target.value as string;
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
                label="Meta-analysis description"
                value={props.metaAnalysisDescription}
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
                nextButtonDisabled={!props.metaAnalysisName || !props.metaAnalysisDescription}
                nextButtonStyle="outlined"
            />
        </Box>
    );
};

export default MetaAnalysisDetails;
