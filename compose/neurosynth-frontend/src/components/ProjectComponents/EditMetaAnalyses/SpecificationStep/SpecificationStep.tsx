import { Box, Button, Step, StepContent, StepLabel, StepProps, Typography } from '@mui/material';
import ProjectComponentsStyles from '../../ProjectComponents.styles';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import { useHistory, useParams } from 'react-router-dom';
import { useAllowEditMetaAnalyses } from 'pages/Projects/ProjectPage/ProjectStore';

interface ISpecificationStep {
    disabled: boolean;
}

const SpecificationStep: React.FC<ISpecificationStep & StepProps> = (props) => {
    const { disabled, ...stepProps } = props;
    const history = useHistory();
    const { projectId } = useParams<{ projectId: string }>();
    const allowEditMetaAnalyses = useAllowEditMetaAnalyses();

    const handleClickProceed = () => {
        allowEditMetaAnalyses();
        history.push(`/projects/${projectId}/meta-analyses`);
    };

    return (
        <Step {...stepProps} expanded={true} sx={ProjectComponentsStyles.step}>
            <StepLabel>
                <Typography sx={{ color: disabled ? 'muted.main' : 'primary.main' }} variant="h6">
                    <b>Proceed to Meta-Analyses</b>: Create a meta-analysis specification
                </Typography>
            </StepLabel>
            <StepContent>
                <Box sx={{ marginLeft: '2rem' }}>
                    <Typography sx={{ color: 'muted.main' }}>
                        <b>
                            Your studyset's studies now have all the relevant information (i.e.
                            metadata, coordinates, annotations) needed for a meta-analysis
                        </b>
                    </Typography>
                    <Typography gutterBottom sx={{ color: 'muted.main' }}>
                        Click the button below to move on to create and run your meta-analysis.
                    </Typography>
                    <Box sx={[ProjectComponentsStyles.stepCard, { height: '230px' }]}>
                        <Button
                            endIcon={<ArrowForwardIosIcon />}
                            color="primary"
                            onClick={handleClickProceed}
                            disabled={disabled}
                            sx={{ width: '100%', height: '100%' }}
                        >
                            Proceed to Meta-Analyses Page
                        </Button>
                    </Box>
                </Box>
            </StepContent>
        </Step>
    );
};

export default SpecificationStep;
