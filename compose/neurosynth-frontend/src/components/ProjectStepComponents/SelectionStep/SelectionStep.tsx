import {
    Box,
    Step,
    StepContent,
    StepLabel,
    StepProps,
    Typography,
    Card,
    CardContent,
    CardActions,
    Button,
} from '@mui/material';
import { useState } from 'react';
import SelectionDialog from 'components/Dialogs/SelectionDialog/SelectionDialog';
import NeurosynthTableStyles from 'components/Tables/NeurosynthTable/NeurosynthTable.styles';
import { EPropertyType } from 'components/EditMetadata';
import ProjectStepComponentsStyles from '../ProjectStepComponents.styles';
import { useProjectSelectionMetadata } from 'pages/Projects/ProjectPage/ProjectStore';

interface ISelectionStep {
    selectionStepHasBeenInitialized: boolean;
    disabled: boolean;
}

const SelectionStep: React.FC<ISelectionStep & StepProps> = (props) => {
    const [selectionDialogIsOpen, setSelectionDialogIsOpen] = useState(false);
    const { selectionStepHasBeenInitialized, disabled, ...stepProps } = props;

    const filter = useProjectSelectionMetadata()?.filter;

    return (
        <Step {...stepProps} expanded={true} sx={ProjectStepComponentsStyles.step}>
            <StepLabel>
                <Typography sx={{ color: disabled ? 'muted.main' : 'primary.main' }} variant="h6">
                    <b>Select</b>: Select the analyses to include
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
                        In this step, select the analyses from each study that you want to include
                        in the meta-analysis based on your analysis annotations
                    </Typography>
                    <SelectionDialog
                        isOpen={selectionDialogIsOpen}
                        onCloseDialog={() => setSelectionDialogIsOpen(false)}
                    />
                    <Box sx={{ marginTop: '1rem' }}>
                        {selectionStepHasBeenInitialized ? (
                            <Box sx={[ProjectStepComponentsStyles.stepCard]}>
                                <Card sx={{ width: '100%', height: '100%' }}>
                                    <CardContent>
                                        <Typography
                                            gutterBottom
                                            variant="h5"
                                            sx={{ marginBottom: '1.5rem' }}
                                        >
                                            Filter:
                                        </Typography>
                                        <Box>
                                            <Typography
                                                variant="h5"
                                                sx={{
                                                    fontWeight: 'bold',
                                                    color: NeurosynthTableStyles[
                                                        filter.type || EPropertyType.NONE
                                                    ],
                                                }}
                                            >
                                                {filter.selectionKey || ''}
                                            </Typography>
                                        </Box>
                                    </CardContent>
                                    <CardActions>
                                        <Button
                                            onClick={() => setSelectionDialogIsOpen(true)}
                                            variant="text"
                                        >
                                            update filter
                                        </Button>
                                    </CardActions>
                                </Card>
                            </Box>
                        ) : (
                            <Box
                                sx={[
                                    ProjectStepComponentsStyles.stepCard,
                                    ProjectStepComponentsStyles.getStartedContainer,
                                    { borderColor: disabled ? 'muted.main' : 'primary.main' },
                                ]}
                            >
                                <Button
                                    onClick={() => setSelectionDialogIsOpen(true)}
                                    disabled={disabled}
                                    sx={{ width: '100%', height: '100%' }}
                                >
                                    selection: get started
                                </Button>
                            </Box>
                        )}
                    </Box>
                </Box>
            </StepContent>
        </Step>
    );
};

export default SelectionStep;
