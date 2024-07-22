import KeyboardDoubleArrowRightIcon from '@mui/icons-material/KeyboardDoubleArrowRight';
import { Box, Button, Step, StepContent, StepLabel, StepProps, Typography } from '@mui/material';
import { IProjectPageLocationState } from 'pages/Project/ProjectPage';
import {
    useAllowEditMetaAnalyses,
    useProjectMetaAnalysisCanEdit,
} from 'pages/Project/store/ProjectStore';
import { useEffect } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import ProjectComponentsStyles from './Project.styles';

interface ISpecificationStep {
    disabled: boolean;
}

const ProjectSpecificationStep: React.FC<ISpecificationStep & StepProps> = (props) => {
    const { disabled, ...stepProps } = props;
    const navigate = useNavigate();
    const { projectId } = useParams<{ projectId: string }>();
    const location = useLocation();
    const allowEditMetaAnalyses = useAllowEditMetaAnalyses();
    const canEditMetaAnalyses = useProjectMetaAnalysisCanEdit();

    useEffect(() => {
        if (disabled) return;
        const shouldScrollDown = (location?.state as IProjectPageLocationState)?.projectPage
            ?.scrollToMetaAnalysisProceed;
        if (shouldScrollDown) {
            window.scrollTo(0, document.body.scrollHeight);
        }
    }, [disabled, location?.state]);

    const handleClickProceed = () => {
        allowEditMetaAnalyses();
        navigate(`/projects/${projectId}/meta-analyses`);
    };

    return (
        <Step {...stepProps} expanded={true} sx={ProjectComponentsStyles.step}>
            <StepLabel>
                <Typography sx={{ color: disabled ? 'muted.main' : 'primary.main' }} variant="h6">
                    <b>Specify Meta-Analyses</b>: Create a meta-analysis specification
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
                            endIcon={
                                canEditMetaAnalyses ? undefined : <KeyboardDoubleArrowRightIcon />
                            }
                            color="primary"
                            onClick={handleClickProceed}
                            variant={
                                disabled ? 'text' : canEditMetaAnalyses ? 'outlined' : 'contained'
                            }
                            disabled={disabled}
                            disableElevation
                            sx={{ width: '100%', height: '100%' }}
                        >
                            {canEditMetaAnalyses
                                ? 'View meta-analyses'
                                : 'Proceed to Meta-Analyses Page'}
                        </Button>
                    </Box>
                </Box>
            </StepContent>
        </Step>
    );
};

export default ProjectSpecificationStep;
