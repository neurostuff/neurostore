import { Box, Button, Step, StepContent, StepLabel, StepProps, Typography } from '@mui/material';
import MoveToExtractionDialog from 'pages/Project/components/MoveToExtractionDialog';
import { IProjectPageLocationState } from 'pages/Project/ProjectPage';
import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import ProjectExtractionStepCard from './ProjectExtractionStepCard';
import ProjectComponentsStyles from 'pages/Project/components/Project.styles';

interface IExtractionStep {
    extractionStepHasBeenInitialized: boolean;
    disabled: boolean;
}

const ProjectExtractionStep: React.FC<IExtractionStep & StepProps> = (props) => {
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
                            <ProjectExtractionStepCard disabled={disabled} />
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

export default ProjectExtractionStep;
