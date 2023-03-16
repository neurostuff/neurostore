import { Box, Step, StepLabel, Stepper } from '@mui/material';
import { ENavigationButton } from 'components/Buttons/NavigationButtons/NavigationButtons';
import { useState } from 'react';
import BaseDialog, { IDialog } from '../BaseDialog';
import MoveToExtractionCreateStudyset from './MoveToExtractionCreateStudyset/MoveToExtractionCreateStudyset';
import MoveToExtractionIngest from './MoveToExtractionIngest/MoveToExtractionIngest';

const MoveToExtractionDialog: React.FC<IDialog> = (props) => {
    const [activeStep, setActiveStep] = useState(1);

    const handleCloseDialog = () => {
        props.onCloseDialog();
    };

    const handleNavigate = (button: ENavigationButton) => {
        setActiveStep((prev) => {
            if (button === ENavigationButton.NEXT) {
                if (activeStep < 2) return prev + 1;
                return prev;
            } else {
                if (activeStep > 0) return prev - 1;
                return prev;
            }
        });
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
                <Stepper activeStep={activeStep}>
                    <Step>
                        <StepLabel>Create Studyset</StepLabel>
                    </Step>
                    <Step>
                        <StepLabel>Ingest</StepLabel>
                    </Step>
                    <Step>
                        <StepLabel>Complete</StepLabel>
                    </Step>
                </Stepper>
                <Box sx={{ marginTop: '1rem' }}>
                    {activeStep === 0 && (
                        <MoveToExtractionCreateStudyset onNavigate={handleNavigate} />
                    )}
                    {activeStep === 1 && <MoveToExtractionIngest onNavigate={handleNavigate} />}
                    {activeStep === 2 && <></>}
                </Box>
            </Box>
        </BaseDialog>
    );
};

export default MoveToExtractionDialog;
