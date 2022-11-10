import {
    Step,
    StepLabel,
    StepContent,
    Typography,
    Box,
    Button,
    StepProps,
    Card,
    CardContent,
    Tooltip,
    CardActions,
} from '@mui/material';
import AlgorithmDialog from 'components/Dialogs/AlgorithmDialog/AlgorithmDialog';
import { useState } from 'react';
import ProjectComponentsStyles from '../ProjectComponents.styles';
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';

interface IAlgorithmStep {
    disabled?: boolean;
    onRunMetaAnalysis: () => void;
}

const AlgorithmStep: React.FC<IAlgorithmStep & StepProps> = (props) => {
    const { onRunMetaAnalysis, disabled, ...stepProps } = props;
    const [algorithmDialogIsOpen, setAlgorithmDialogIsOpen] = useState(false);
    const [hasAlgorithm, setHasAlgorithm] = useState(false);

    return (
        <Step {...stepProps} expanded={true} sx={ProjectComponentsStyles.step}>
            <StepLabel>
                <Typography
                    sx={{ color: props.disabled ? 'muted.main' : 'primary.main' }}
                    variant="h6"
                >
                    <b>Algorithm</b>: Select the desired algorithm and associated arguments
                </Typography>
            </StepLabel>
            <StepContent>
                <Box sx={{ marginLeft: '2rem' }}>
                    <Typography gutterBottom sx={{ color: 'muted.main' }}>
                        <b>
                            You have a finalized studyset full of studies that have all relevant
                            data and annotations. You have selected the analyses you would like to
                            use for your meta-analysis.
                        </b>
                        In this step, select the meta-analytic algorithm you would like to use as
                        well as any associated configurations (like kernel size, number of
                        iterations, and an associated corrector)
                    </Typography>

                    {hasAlgorithm ? (
                        <Box sx={ProjectComponentsStyles.stepCard}>
                            <Card sx={{ width: '100%' }}>
                                <CardContent>
                                    <Typography gutterBottom variant="h5">
                                        Algorithm Step
                                    </Typography>
                                    <Typography variant="h6" sx={{ color: 'muted.main' }}>
                                        Algorithm: ALE
                                    </Typography>
                                    <Typography
                                        variant="h6"
                                        gutterBottom
                                        sx={{ color: 'muted.main' }}
                                    >
                                        Corrector: FDRCorrector
                                    </Typography>
                                    <AlgorithmDialog
                                        isOpen={algorithmDialogIsOpen}
                                        onCloseDialog={() => setAlgorithmDialogIsOpen(false)}
                                    />
                                </CardContent>
                                <CardActions
                                    sx={{ display: 'flex', justifyContent: 'space-between' }}
                                >
                                    <Button
                                        onClick={() => setAlgorithmDialogIsOpen(true)}
                                        variant="text"
                                    >
                                        modify algorithm
                                    </Button>
                                    <Button
                                        onClick={() => props.onRunMetaAnalysis()}
                                        variant="contained"
                                    >
                                        run meta-analysis
                                    </Button>
                                </CardActions>
                            </Card>
                        </Box>
                    ) : (
                        <Tooltip
                            placement="right"
                            title={
                                props.disabled ? 'You must complete the previous step first' : ''
                            }
                        >
                            <Box
                                sx={[
                                    ProjectComponentsStyles.stepCard,
                                    ProjectComponentsStyles.getStartedContainer,
                                    { borderColor: props.disabled ? 'lightgray' : 'primary.main' },
                                ]}
                            >
                                <Button
                                    sx={{ width: '100%', height: '100%' }}
                                    disabled={props.disabled}
                                    endIcon={<KeyboardArrowDown />}
                                    onClick={() => setHasAlgorithm(true)}
                                >
                                    Algorithm: get started
                                </Button>
                            </Box>
                        </Tooltip>
                    )}
                </Box>
            </StepContent>
        </Step>
    );
};

export default AlgorithmStep;
