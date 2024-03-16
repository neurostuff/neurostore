import { Box, Button, Step, StepContent, StepLabel, StepProps, Typography } from '@mui/material';
import MoveToExtractionDialog from 'components/Dialogs/MoveToExtractionDialog/MoveToExtractionDialog';
import { IProjectPageLocationState } from 'pages/Projects/ProjectPage/ProjectPage';
import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import ProjectComponentsStyles from '../../ProjectComponents.styles';
import ExtractionStepCard from './ExtractionStepCard';

interface IExtractionStep {
    extractionStepHasBeenInitialized: boolean;
    disabled: boolean;
}

const ExtractionStep: React.FC<IExtractionStep & StepProps> = (props) => {
    const { extractionStepHasBeenInitialized, disabled, ...stepProps } = props;
    const location = useLocation();

    const [moveToExtractionDialogIsOpen, setMoveToExtractionDialogIsOpen] = useState(
        !extractionStepHasBeenInitialized &&
            !!(location?.state as IProjectPageLocationState)?.projectPage?.openCurationDialog
    );

    return (
        <Step {...stepProps} expanded={true} sx={ProjectComponentsStyles.step}>
            <StepLabel>
                <Typography sx={{ color: disabled ? 'muted.main' : 'primary.main' }} variant="h6">
                    <b>Extract & Annotate</b>: Add relevant study data
                </Typography>
            </StepLabel>
            <StepContent>
                <MoveToExtractionDialog
                    isOpen={moveToExtractionDialogIsOpen}
                    onCloseDialog={() => setMoveToExtractionDialogIsOpen(false)}
                />
                <Box sx={{ marginLeft: '2rem' }}>
                    <Typography sx={{ color: 'muted.main' }}>
                        <b>
                            You have completed your study curation, and now have a potential list of
                            studies to include in your meta-analysis
                        </b>
                    </Typography>
                    <Typography gutterBottom sx={{ color: 'muted.main' }}>
                        In this step, add necessary study data to the studies in your studyset (like
                        coordinates and metadata) as well as analysis annotations that will be used
                        to help filter analyses within your studies
                    </Typography>
                    <Box sx={{ marginTop: '1rem' }}>
                        {extractionStepHasBeenInitialized ? (
                            <ExtractionStepCard disabled={disabled} />
                        ) : (
                            <Box
                                sx={[
                                    ProjectComponentsStyles.stepCard,
                                    ProjectComponentsStyles.getStartedContainer,
                                    { borderColor: disabled ? 'muted.main' : 'primary.main' },
                                ]}
                            >
                                <Button
                                    onClick={() => setMoveToExtractionDialogIsOpen(true)}
                                    disabled={disabled}
                                    sx={{ width: '100%', height: '100%' }}
                                >
                                    extraction: get started
                                </Button>
                            </Box>
                        )}
                    </Box>
                </Box>
            </StepContent>
        </Step>
    );
};

export default ExtractionStep;
