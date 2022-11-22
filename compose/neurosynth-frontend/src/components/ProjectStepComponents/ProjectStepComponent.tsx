import { Box, Step, StepContent, StepLabel, StepProps } from '@mui/material';
import { useParams } from 'react-router-dom';
import ProjectStepComponentsStyles from './ProjectStepComponents.styles';

interface IProjectStepComponent {
    stepTitleElement: JSX.Element;
    descriptionElement: JSX.Element;
    enabledElement: JSX.Element;
    disabled: boolean;
}

const ProjectStepComponent: React.FC<IProjectStepComponent & StepProps> = (props) => {
    const { projectId }: { projectId: string } = useParams();
    const {
        stepTitleElement = <></>,
        descriptionElement = <></>,
        enabledElement = <></>,
        disabled = true,
        ...stepProps
    } = props;

    return (
        <Step {...stepProps} expanded={true} sx={ProjectStepComponentsStyles.step}>
            <StepLabel>{stepTitleElement}</StepLabel>
            <StepContent>
                <Box sx={{ marginLeft: '2rem' }}>
                    {descriptionElement}
                    <Box>{enabledElement}</Box>
                </Box>
            </StepContent>
        </Step>
    );
};

export default ProjectStepComponent;
