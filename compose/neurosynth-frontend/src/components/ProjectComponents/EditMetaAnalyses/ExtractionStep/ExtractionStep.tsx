import QuestionMarkIcon from '@mui/icons-material/QuestionMark';
import CheckIcon from '@mui/icons-material/Check';
import BookmarkIcon from '@mui/icons-material/Bookmark';
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
import { useHistory, useLocation, useParams } from 'react-router-dom';
import ProjectComponentsStyles from '../../ProjectComponents.styles';
import { useState } from 'react';
import MoveToExtractionDialog from 'components/Dialogs/MoveToExtractionDialog/MoveToExtractionDialogBase';
import useGetExtractionSummary, { IExtractionSummary } from 'hooks/useGetExtractionSummary';
import ExtractionStepStyles from './ExtractionStep.style';
import { useGetStudysetById } from 'hooks';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import { IProjectPageLocationState } from 'pages/Projects/ProjectPage/ProjectPage';
import {
    useProjectExtractionSetGivenStudyStatusesAsComplete,
    useProjectExtractionStudysetId,
} from 'pages/Projects/ProjectPage/ProjectStore';
import ConfirmationDialog from 'components/Dialogs/ConfirmationDialog/ConfirmationDialog';
import { StudyReturn } from 'neurostore-typescript-sdk';

interface IExtractionStep {
    extractionStepHasBeenInitialized: boolean;
    disabled: boolean;
}

const getPercentageComplete = (extractionSummary: IExtractionSummary): number => {
    if (extractionSummary.total === 0) return 0;
    const percentageComplete = (extractionSummary.completed / extractionSummary.total) * 100;
    return Math.round(percentageComplete);
};

const ExtractionStep: React.FC<IExtractionStep & StepProps> = (props) => {
    const { projectId }: { projectId: string } = useParams();
    const studysetId = useProjectExtractionStudysetId();
    const setGivenStudyStatusesAsComplete = useProjectExtractionSetGivenStudyStatusesAsComplete();
    const {
        data: studyset,
        isError: getStudysetIsError,
        isLoading: getStudysetIsLoading,
    } = useGetStudysetById(studysetId, false);
    const { extractionStepHasBeenInitialized, disabled, ...stepProps } = props;
    const extractionSummary = useGetExtractionSummary(projectId);
    const history = useHistory();
    const location = useLocation<IProjectPageLocationState>();
    const [
        markAllAsCompleteConfirmationDialogIsOpen,
        setMarkAllAsCompleteConfirmationDialogIsOpen,
    ] = useState(false);

    // this is set in the curation phase when we click to move on to the extraction phase.
    // a flag is sent along with the location data when the page is redirected
    // const [moveToExtractionDialogIsOpen, setMoveToExtractionDialogIsOpen] = useState(
    //     !extractionStepHasBeenInitialized && !!location?.state?.projectPage?.openCurationDialog
    // );
    const [moveToExtractionDialogIsOpen, setMoveToExtractionDialogIsOpen] = useState(
        !extractionStepHasBeenInitialized && !!location?.state?.projectPage?.openCurationDialog
    );

    const handleMarkAllAsComplete = () => {
        if (studyset?.studies) {
            setGivenStudyStatusesAsComplete(
                (studyset.studies as StudyReturn[]).map((x) => x.id || '')
            );
            setMarkAllAsCompleteConfirmationDialogIsOpen(false);
        }
    };

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
                            <Box sx={[ProjectComponentsStyles.stepCard]}>
                                <Card
                                    sx={{
                                        width: '100%',
                                        height: '100%',
                                        minHeight: '165px',
                                        padding: '8px',
                                    }}
                                >
                                    <StateHandlerComponent
                                        isError={getStudysetIsError}
                                        isLoading={getStudysetIsLoading}
                                    >
                                        <CardContent>
                                            <Box sx={ProjectComponentsStyles.stepTitle}>
                                                <Typography sx={{ color: 'muted.main' }}>
                                                    {studyset?.studies?.length || 0} studies
                                                </Typography>
                                                <CircularProgress
                                                    sx={ProjectComponentsStyles.progressCircle}
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
                                            <Typography
                                                gutterBottom
                                                variant="h5"
                                                sx={{ marginRight: '40px' }}
                                            >
                                                {studyset?.name || ''}
                                            </Typography>

                                            <Box sx={ProjectComponentsStyles.statusContainer}>
                                                <Box
                                                    sx={ProjectComponentsStyles.statusIconContainer}
                                                >
                                                    <CheckIcon
                                                        sx={ExtractionStepStyles.checkIcon}
                                                    />
                                                    <Typography sx={{ color: 'success.main' }}>
                                                        {extractionSummary.completed} completed
                                                    </Typography>
                                                </Box>
                                                <Box
                                                    sx={ProjectComponentsStyles.statusIconContainer}
                                                >
                                                    <BookmarkIcon
                                                        sx={ExtractionStepStyles.saveForLater}
                                                    />
                                                    <Typography sx={{ color: 'info.main' }}>
                                                        {extractionSummary.savedForLater} saved for
                                                        later
                                                    </Typography>
                                                </Box>
                                                <Box
                                                    sx={ProjectComponentsStyles.statusIconContainer}
                                                >
                                                    <QuestionMarkIcon
                                                        sx={ExtractionStepStyles.uncategorizedIcon}
                                                    />
                                                    <Typography sx={{ color: 'warning.dark' }}>
                                                        {extractionSummary.uncategorized}{' '}
                                                        uncategorized
                                                    </Typography>
                                                </Box>
                                            </Box>
                                        </CardContent>
                                        <CardActions
                                            sx={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                            }}
                                        >
                                            <Button
                                                color="secondary"
                                                onClick={() =>
                                                    history.push(
                                                        `/projects/${projectId}/extraction`
                                                    )
                                                }
                                                variant="text"
                                            >
                                                continue editing
                                            </Button>
                                            <ConfirmationDialog
                                                onCloseDialog={handleMarkAllAsComplete}
                                                rejectText="Cancel"
                                                confirmText="Mark all as complete"
                                                isOpen={markAllAsCompleteConfirmationDialogIsOpen}
                                                dialogTitle="Are you sure you want to mark all the studies as complete?"
                                                dialogMessage="The selection phase will be enabled when all studies in the extraction phase have been marked as complete. You can skip or expedite the extraction process by clicking this button. This may result in some studies in the studyset having incomplete or unextracted data."
                                            />
                                            <Button
                                                onClick={() =>
                                                    setMarkAllAsCompleteConfirmationDialogIsOpen(
                                                        true
                                                    )
                                                }
                                                color="success"
                                            >
                                                Mark all as complete
                                            </Button>
                                        </CardActions>
                                    </StateHandlerComponent>
                                </Card>
                            </Box>
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
