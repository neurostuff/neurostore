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
import { Tabs, Tab } from '@mui/material';

const ProjectPage: React.FC = (props) => {
    const [activeStep, setActiveStep] = useState(0);

    const [extractionIsDisabled, setExtractionIsDisabled] = useState(true);
    const [filtrationIsDisabled, setFiltrationIsDisabled] = useState(true);
    const [algorithmIsDisabled, setAlgorithmIsDisabled] = useState(true);

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
                    <div style={{ position: 'absolute', right: 0 }}>
                        <Button onClick={() => setExtractionIsDisabled(false)}>
                            enable extraction (for demo purposes)
                        </Button>
                        <br />
                        <Button onClick={() => setFiltrationIsDisabled(false)}>
                            enable filtration (for demo purposes)
                        </Button>
                        <br />
                        <Button onClick={() => setAlgorithmIsDisabled(false)}>
                            enable algorithm (for demo purposes)
                        </Button>
                    </div>
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

            <Tabs sx={{ marginBottom: '1rem' }} value={0}>
                <Tab value={0} label="Build Meta-Analysis" />
                <Tab value={1} disabled label="View-Meta-Analysis" />
            </Tabs>

            <Stepper
                activeStep={activeStep}
                orientation="vertical"
                sx={{ '.MuiStepConnector-root': { marginLeft: '20px' } }}
            >
                <CurationStep />
                <ExtractionStep disabled={extractionIsDisabled} />
                <FiltrationStep disabled={filtrationIsDisabled} />
                <AlgorithmStep disabled={algorithmIsDisabled} />
            </Stepper>
        </Box>
    );
};

export default ProjectPage;
