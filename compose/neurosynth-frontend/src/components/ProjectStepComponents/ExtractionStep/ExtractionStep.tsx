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
} from '@mui/material';
import { IExtractionMetadata } from 'hooks/requests/useGetProjects';
import { useHistory, useParams } from 'react-router-dom';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import ProjectStepComponentsStyles from '../ProjectStepComponents.styles';
import { useState } from 'react';
import MoveToExtractionDialog from 'components/Dialogs/MoveToExtractionDialog/MoveToExtractionDialog';
import useGetExtractionSummary, { IExtractionSummary } from 'hooks/useGetExtractionSummary';
import ExtractionStepStyles from './ExtractionStep.style';
import { useGetStudysetById } from 'hooks';
import useGetProjectById from 'hooks/requests/useGetProjectById';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';

interface IExtractionStep {
    extractionMetadata: IExtractionMetadata | undefined;
    disabled: boolean;
}

const getPercentageComplete = (extractionSummary: IExtractionSummary): number => {
    if (extractionSummary.total === 0) return 0;
    const percentageComplete = (extractionSummary.completed / extractionSummary.total) * 100;
    return Math.round(percentageComplete);
};

const ExtractionStep: React.FC<IExtractionStep & StepProps> = (props) => {
    const { projectId }: { projectId: string } = useParams();
    const {
        data: project,
        isError: getProjectIsError,
        isLoading: getProjectIsLoading,
    } = useGetProjectById(projectId);
    const {
        data: studyset,
        isError: getStudysetIsError,
        isLoading: getStudysetIsLoading,
    } = useGetStudysetById(project?.provenance?.extractionMetadata?.studysetId);
    const extractionSummary = useGetExtractionSummary(projectId);
    const history = useHistory();
    const [moveToExtractionDialog, setMoveToExtractionDialog] = useState(false);
    const { extractionMetadata, disabled, ...stepProps } = props;

    const extractionMetadataExists = !!extractionMetadata;

    return (
        <Step {...stepProps} expanded={true} sx={ProjectStepComponentsStyles.step}>
            <StepLabel>
                <Typography sx={{ color: disabled ? 'muted.main' : 'primary.main' }} variant="h6">
                    <b>Extraction & Annotation</b>: Add relevant study data
                </Typography>
            </StepLabel>
            <StepContent>
                <StateHandlerComponent
                    isError={getProjectIsError || getStudysetIsError}
                    isLoading={getProjectIsLoading || getStudysetIsLoading}
                >
                    <Box sx={{ marginLeft: '2rem' }}>
                        <Typography sx={{ color: 'muted.main' }}>
                            <b>
                                You have completed your study curation, and now have a potential
                                list of studies to include in your meta-analysis
                            </b>
                        </Typography>
                        <Typography gutterBottom sx={{ color: 'muted.main' }}>
                            In this step, add necessary study data to the studies in your studyset
                            (like coordinates and metadata) as well as analysis annotations that
                            will be used to help filter analyses within your studies
                        </Typography>
                        <Box sx={{ marginTop: '1rem' }}>
                            {extractionMetadataExists ? (
                                <Box sx={[ProjectStepComponentsStyles.stepCard]}>
                                    <Card sx={{ width: '100%', height: '100%' }}>
                                        <CardContent>
                                            <Box sx={ProjectStepComponentsStyles.stepTitle}>
                                                <Typography
                                                    gutterBottom
                                                    variant="h5"
                                                    sx={{ marginRight: '40px' }}
                                                >
                                                    {studyset?.name || ''}
                                                </Typography>
                                                <CircularProgress
                                                    sx={ProjectStepComponentsStyles.progressCircle}
                                                    variant="determinate"
                                                    value={getPercentageComplete(extractionSummary)}
                                                    color={
                                                        getPercentageComplete(extractionSummary) ===
                                                        100
                                                            ? 'success'
                                                            : 'secondary'
                                                    }
                                                />
                                            </Box>
                                            <Box sx={ProjectStepComponentsStyles.statusContainer}>
                                                <Box
                                                    sx={
                                                        ProjectStepComponentsStyles.statusIconContainer
                                                    }
                                                >
                                                    <CheckIcon
                                                        sx={ExtractionStepStyles.checkIcon}
                                                    />
                                                    <Typography sx={{ color: 'success.main' }}>
                                                        {extractionSummary.completed} completed
                                                    </Typography>
                                                </Box>
                                                <Box
                                                    sx={
                                                        ProjectStepComponentsStyles.statusIconContainer
                                                    }
                                                >
                                                    <BookmarkIcon
                                                        sx={ExtractionStepStyles.saveForLater}
                                                    />
                                                    <Typography sx={{ color: 'warning.dark' }}>
                                                        {extractionSummary.savedForLater} saved for
                                                        later
                                                    </Typography>
                                                </Box>
                                                <Box
                                                    sx={
                                                        ProjectStepComponentsStyles.statusIconContainer
                                                    }
                                                >
                                                    <QuestionMarkIcon
                                                        sx={ExtractionStepStyles.closeIcon}
                                                    />
                                                    <Typography sx={{ color: 'error.dark' }}>
                                                        {extractionSummary.uncategorized}{' '}
                                                        uncategorized
                                                    </Typography>
                                                </Box>
                                            </Box>
                                        </CardContent>
                                        <CardActions>
                                            <Button
                                                onClick={() =>
                                                    history.push(
                                                        `/projects/${projectId}/extraction`
                                                    )
                                                }
                                                variant="text"
                                            >
                                                continue editing
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
                                    <MoveToExtractionDialog
                                        isOpen={moveToExtractionDialog}
                                        onCloseDialog={() => setMoveToExtractionDialog(false)}
                                    />
                                    <Button
                                        onClick={() => setMoveToExtractionDialog(true)}
                                        disabled={disabled}
                                        sx={{ width: '100%', height: '100%' }}
                                    >
                                        extraction: get started
                                    </Button>
                                </Box>
                            )}
                        </Box>
                    </Box>
                </StateHandlerComponent>
            </StepContent>
        </Step>
    );
};

export default ExtractionStep;
