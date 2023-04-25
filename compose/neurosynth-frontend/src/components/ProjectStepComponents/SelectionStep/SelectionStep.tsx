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
    Chip,
} from '@mui/material';
import { useState } from 'react';
import SelectionDialog, {
    getFilteredAnnotationNotes,
} from 'components/Dialogs/SelectionDialog/SelectionDialog';
import NeurosynthTableStyles from 'components/Tables/NeurosynthTable/NeurosynthTable.styles';
import { EPropertyType } from 'components/EditMetadata';
import ProjectStepComponentsStyles from '../ProjectStepComponents.styles';
import {
    useProjectExtractionAnnotationId,
    useProjectSelectionMetadata,
} from 'pages/Projects/ProjectPage/ProjectStore';
import { useGetAnnotationById } from 'hooks';
import { NoteCollectionReturn } from 'neurostore-typescript-sdk';

interface ISelectionStep {
    selectionStepHasBeenInitialized: boolean;
    disabled: boolean;
}

const SelectionStep: React.FC<ISelectionStep & StepProps> = (props) => {
    const [selectionDialogIsOpen, setSelectionDialogIsOpen] = useState(false);
    const annotationId = useProjectExtractionAnnotationId();
    const { data: annotation } = useGetAnnotationById(annotationId);
    const { selectionStepHasBeenInitialized, disabled, ...stepProps } = props;

    const filter = useProjectSelectionMetadata()?.filter;
    const filteredAnnotations = getFilteredAnnotationNotes(
        (annotation?.notes || []) as NoteCollectionReturn[],
        filter?.selectionKey
    );

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
                                        <Box>
                                            <Box sx={{ display: 'flex' }}>
                                                <Typography
                                                    sx={{ marginRight: '15px' }}
                                                    gutterBottom
                                                    variant="h5"
                                                >
                                                    Selection Filter:
                                                </Typography>
                                                <Chip
                                                    color={
                                                        filter.type === EPropertyType.BOOLEAN
                                                            ? 'success'
                                                            : filter.type === EPropertyType.NUMBER
                                                            ? 'primary'
                                                            : 'secondary'
                                                    }
                                                    size="medium"
                                                    label={filter.selectionKey || ''}
                                                />
                                            </Box>
                                            <Box>
                                                <Typography
                                                    variant="h5"
                                                    sx={{ color: 'info.main' }}
                                                >
                                                    {filteredAnnotations.length} /{' '}
                                                    {annotation?.notes?.length || 0} analyses
                                                    selected
                                                </Typography>
                                            </Box>
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
