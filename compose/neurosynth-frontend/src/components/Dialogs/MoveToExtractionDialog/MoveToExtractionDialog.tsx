import { Box, Step, StepLabel, Stepper } from '@mui/material';
import { useState } from 'react';
import BaseDialog, { IDialog } from '../BaseDialog';
import MoveToExtractionCreateStudysetStep from './MoveToExtractionCreateStudysetStep/MoveToExtractionCreateStudysetStep';

const MoveToExtractionDialog: React.FC<IDialog> = (props) => {
    const [activeStep, setActiveStep] = useState(0);

    const handleCloseDialog = () => {
        props.onCloseDialog();
        setActiveStep(0);
    };

    return (
        <BaseDialog
            dialogTitle="Extraction Phase: Get Started"
            isOpen={props.isOpen}
            fullWidth
            maxWidth="md"
            onCloseDialog={handleCloseDialog}
        >
            <Box>
                <Stepper sx={{ marginBottom: '1rem' }} activeStep={activeStep}>
                    <Step>
                        <StepLabel>Create Studyset</StepLabel>
                    </Step>
                    <Step>
                        <StepLabel>Ingest Studies</StepLabel>
                    </Step>
                    <Step disabled>
                        <StepLabel>Resolve Duplicates</StepLabel>
                    </Step>
                    <Step>
                        <StepLabel>Complete</StepLabel>
                    </Step>
                </Stepper>

                {activeStep === 0 && <MoveToExtractionCreateStudysetStep />}
            </Box>
        </BaseDialog>
    );
};

export default MoveToExtractionDialog;
