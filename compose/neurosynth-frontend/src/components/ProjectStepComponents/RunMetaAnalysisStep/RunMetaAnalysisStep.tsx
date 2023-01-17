import { Step, StepContent, StepLabel, Box, Typography, Button, StepProps } from '@mui/material';
import ProjectStepComponentsStyles from '../ProjectStepComponents.styles';

interface IRunMetaAnalysisStep {
    disabled: boolean;
}

const RunMetaAnalysisStep: React.FC<IRunMetaAnalysisStep & StepProps> = (props) => {
    const { disabled, ...stepProps } = props;

    // const disabled = !project?.provenance?.algorithmMetadata?.specificationId;

    return (
        <Step {...stepProps} expanded={true} sx={ProjectStepComponentsStyles.step}>
            <StepLabel>
                <Typography sx={{ color: disabled ? 'muted.main' : 'primary.main' }} variant="h6">
                    Run Meta-Analysis
                </Typography>
            </StepLabel>
            <StepContent>
                <Box
                    sx={[
                        ProjectStepComponentsStyles.stepCard,
                        {
                            marginLeft: '2rem',
                            height: '230px',
                            border: '2px solid',
                            borderColor: disabled ? 'muted.main' : 'primary.main',
                        },
                    ]}
                >
                    <Button
                        disabled={disabled}
                        sx={{
                            width: '100%',
                            height: '100%',
                            color: props ? 'muted.main' : 'primary.main',
                        }}
                    >
                        run meta-analysis
                    </Button>
                </Box>
            </StepContent>
        </Step>
    );
};

export default RunMetaAnalysisStep;
