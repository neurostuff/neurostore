import { Box, Typography, Stepper, Step, StepLabel, Button } from '@mui/material';
import { useState } from 'react';
import BaseDialog, { IDialog } from '../BaseDialog';
import IngestionCompleteStep from './IngestionCompleteStep/IngestionCompleteStep';
import IngestionStep from './IngestionStep/IngestionStep';

const IngestionDialog: React.FC<IDialog> = (props) => {
    const [activeStep, setActiveStep] = useState(0);

    const handleOnComplete = () => {
        setActiveStep(0);
        props.onCloseDialog();
    };

    return (
        <BaseDialog
            dialogTitle="Ingestion"
            isOpen={props.isOpen}
            fullWidth
            maxWidth="md"
            onCloseDialog={props.onCloseDialog}
        >
            <Box>
                <Stepper sx={{ marginBottom: '1rem' }} activeStep={activeStep}>
                    <Step>
                        <StepLabel>Introduction</StepLabel>
                    </Step>
                    <Step>
                        <StepLabel>Ingestion</StepLabel>
                    </Step>
                    <Step>
                        <StepLabel>Complete</StepLabel>
                    </Step>
                </Stepper>

                {activeStep === 0 && (
                    <Box>
                        <Typography gutterBottom sx={{ color: 'muted.main' }}>
                            In order to get started with extraction,{' '}
                            <b>
                                the studies included in the curation step need to be ingested into
                                the database
                            </b>
                            .
                        </Typography>
                        <Typography gutterBottom sx={{ color: 'muted.main' }}>
                            If neurosynth-compose already contains a study that you are trying to
                            ingest, you have the option of selecting that study to add to your
                            studyset.
                        </Typography>

                        <Button
                            onClick={() => setActiveStep((prev) => prev + 1)}
                            sx={{ display: 'block', marginLeft: 'auto' }}
                            variant="outlined"
                        >
                            next
                        </Button>
                    </Box>
                )}

                {activeStep === 1 && (
                    <IngestionStep onNext={() => setActiveStep((prev) => prev + 1)} />
                )}
                {activeStep === 2 && <IngestionCompleteStep onComplete={handleOnComplete} />}
            </Box>
        </BaseDialog>
    );
};

export default IngestionDialog;
