import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import StepContent from '@mui/material/StepContent';
import TextEdit from 'components/TextEdit/TextEdit';
import { useState } from 'react';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActions from '@mui/material/CardActions';
import CurationStep from 'components/ProjectComponents/CurationStep/CurationStep';
import ExtractionStep from 'components/ProjectComponents/ExtractionStep/ExtractionStep';
import FiltrationStep from 'components/ProjectComponents/FiltrationStep/FiltrationStep';
import AlgorithmStep from 'components/ProjectComponents/AlgorithmStep/AlgorithmStep';

const ProjectPage: React.FC = (props) => {
    const [activeStep, setActiveStep] = useState(0);

    const handleNext = () => {
        setActiveStep((prevActiveStep) => prevActiveStep + 1);
    };

    const handleBack = () => {
        setActiveStep((prevActiveStep) => prevActiveStep - 1);
    };

    const handleReset = () => {
        setActiveStep(0);
    };

    return (
        <Box>
            <Box sx={{ marginBottom: '1rem' }}>
                <TextEdit
                    onSave={() => {}}
                    sx={{ fontSize: '2rem' }}
                    textToEdit="My new project demo"
                >
                    <Typography variant="h4">My new project demo</Typography>
                </TextEdit>
                <TextEdit
                    onSave={() => {}}
                    textToEdit="This is a demo of an MVP for a redesigned project centered meta-analysis
                        user flow"
                >
                    <Typography>
                        This is a demo of an MVP for a redesigned project centered meta-analysis
                        user flow
                    </Typography>
                </TextEdit>
            </Box>

            <Stepper
                activeStep={activeStep}
                orientation="vertical"
                sx={{ '.MuiStepConnector-root': { marginLeft: '20px' } }}
            >
                <CurationStep />
                <ExtractionStep />
                <FiltrationStep />
                <AlgorithmStep />
            </Stepper>
            {/* <Box>
                <Button onClick={() => handleBack()}>prev</Button>
                <Button onClick={() => handleNext()}>next</Button>
            </Box> */}
        </Box>
    );
};

export default ProjectPage;
