import QuestionMarkIcon from '@mui/icons-material/QuestionMark';
import CloseIcon from '@mui/icons-material/Close';
import CheckIcon from '@mui/icons-material/Check';
import {
    Box,
    Step,
    StepContent,
    StepLabel,
    StepProps,
    Typography,
    Card,
    CardContent,
    CircularProgress,
    CardActions,
    Button,
    Divider,
} from '@mui/material';
import { useHistory, useParams } from 'react-router-dom';
import ProjectStepComponentsStyles from '../ProjectStepComponents.styles';
import { useState } from 'react';
import AlgorithmDialog from 'components/Dialogs/AlgorithmDialog/AlgorithmDialog';
import { useAlgorithmSpecificationId } from 'pages/Projects/ProjectPage/ProjectStore';
import useGetSpecification from 'hooks/requests/useGetSpecificationById';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import MetaAnalysisSummaryRow from 'components/MetaAnalysisConfigComponents/MetaAnalysisSummaryRow/MetaAnalysisSummaryRow';
import DynamicInputDisplay from 'components/MetaAnalysisConfigComponents/DynamicInputDisplay/DynamicInputDisplay';
import { IDynamicValueType } from 'components/MetaAnalysisConfigComponents';

interface IAlgorithmStep {
    algorithmStepHasBeenInitialized: boolean;
    disabled: boolean;
}

const AlgorithmStep: React.FC<IAlgorithmStep & StepProps> = (props) => {
    const { projectId }: { projectId: string } = useParams();
    const { algorithmStepHasBeenInitialized, disabled, ...stepProps } = props;
    const specificationId = useAlgorithmSpecificationId();
    const {
        data: specification,
        isLoading: getSpecificationIsLoading,
        isError: getSpecificationIsError,
    } = useGetSpecification(specificationId);
    const history = useHistory();
    const [algorithmDialogIsOpen, setAlgorithmDialogIsOpen] = useState(false);

    return (
        <Step {...stepProps} expanded={true} sx={ProjectStepComponentsStyles.step}>
            <StepLabel>
                <Typography sx={{ color: disabled ? 'muted.main' : 'primary.main' }} variant="h6">
                    <b>Specify</b>: Specify the desired algorithm and associated arguments
                </Typography>
            </StepLabel>
            <StepContent>
                <Box sx={{ marginLeft: '2rem' }}>
                    <Typography sx={{ color: 'muted.main' }}>
                        <b>
                            You have a finalized studyset full of studies that have all necessary
                            coordinates/data and annotations. You have selected the analyses to use
                            for your meta-analyses.
                        </b>
                    </Typography>
                    <Typography gutterBottom sx={{ color: 'muted.main' }}>
                        In this step, select the meta-analytic algorithm that you would like to use
                        as well as associated configurations (kernel size, number of iterations, or
                        associated corrector)
                    </Typography>
                    <AlgorithmDialog
                        isOpen={algorithmDialogIsOpen}
                        onCloseDialog={() => setAlgorithmDialogIsOpen(false)}
                    />
                    <Box sx={{ marginTop: '1rem' }}>
                        {algorithmStepHasBeenInitialized ? (
                            <Box sx={[ProjectStepComponentsStyles.stepCard]}>
                                <Card
                                    sx={{
                                        width: '100%',
                                        height: '100%',
                                        minHeight: '165px',
                                        padding: '8px',
                                    }}
                                >
                                    <StateHandlerComponent
                                        isLoading={getSpecificationIsLoading}
                                        isError={getSpecificationIsError}
                                    >
                                        <CardContent>
                                            <Box
                                                sx={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    flexDirection: 'column',
                                                }}
                                            >
                                                <Typography gutterBottom variant="h5">
                                                    Specification
                                                </Typography>
                                                <MetaAnalysisSummaryRow
                                                    title="meta-analysis type"
                                                    value={specification?.type || ''}
                                                ></MetaAnalysisSummaryRow>
                                                <MetaAnalysisSummaryRow
                                                    title="algorithm and optional arguments"
                                                    value={specification?.estimator?.type || ''}
                                                >
                                                    <DynamicInputDisplay
                                                        dynamicArg={
                                                            (specification?.estimator?.args ||
                                                                {}) as IDynamicValueType
                                                        }
                                                    />
                                                </MetaAnalysisSummaryRow>
                                                <MetaAnalysisSummaryRow
                                                    title="corrector and optional arguments"
                                                    value={specification?.corrector?.type || ''}
                                                >
                                                    <DynamicInputDisplay
                                                        dynamicArg={
                                                            (specification?.corrector?.args ||
                                                                {}) as IDynamicValueType
                                                        }
                                                    />
                                                </MetaAnalysisSummaryRow>
                                            </Box>
                                        </CardContent>
                                        <CardActions>
                                            <Button
                                                onClick={() =>
                                                    history.push(`/projects/${projectId}/curation`)
                                                }
                                                variant="text"
                                            >
                                                continue editing
                                            </Button>
                                        </CardActions>
                                    </StateHandlerComponent>
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
                                    onClick={() => setAlgorithmDialogIsOpen(true)}
                                    disabled={disabled}
                                    sx={{ width: '100%', height: '100%' }}
                                >
                                    algorithm: get started
                                </Button>
                            </Box>
                        )}
                    </Box>
                </Box>
            </StepContent>
        </Step>
    );
};

export default AlgorithmStep;
