import BookmarkIcon from '@mui/icons-material/Bookmark';
import CheckIcon from '@mui/icons-material/Check';
import QuestionMarkIcon from '@mui/icons-material/QuestionMark';
import {
    Box,
    Card,
    CardContent,
    Typography,
    CircularProgress,
    CardActions,
    Button,
} from '@mui/material';
import ConfirmationDialog from 'components/Dialogs/ConfirmationDialog/ConfirmationDialog';
import ProjectComponentsStyles from 'components/ProjectComponents/ProjectComponents.styles';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import ExtractionStepStyles from './ExtractionStep.style';
import { useNavigate, useParams } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { useGetExtractionSummary, useGetStudysetById } from 'hooks';
import {
    useProjectExtractionSetGivenStudyStatusesAsComplete,
    useProjectExtractionStudysetId,
} from 'pages/Projects/ProjectPage/ProjectStore';
import { IExtractionSummary } from 'hooks/useGetExtractionSummary';

const getPercentageComplete = (extractionSummary: IExtractionSummary): number => {
    if (extractionSummary.total === 0) return 0;
    const percentageComplete = (extractionSummary.completed / extractionSummary.total) * 100;
    return Math.round(percentageComplete);
};

const ExtractionStepCard: React.FC<{ disabled: boolean }> = ({ disabled }) => {
    const [
        markAllAsCompleteConfirmationDialogIsOpen,
        setMarkAllAsCompleteConfirmationDialogIsOpen,
    ] = useState(false);
    const studysetId = useProjectExtractionStudysetId();
    const { projectId } = useParams<{ projectId: string }>();
    const extractionSummary = useGetExtractionSummary(projectId);

    const setGivenStudyStatusesAsComplete = useProjectExtractionSetGivenStudyStatusesAsComplete();
    const {
        data: studyset,
        isError: getStudysetIsError,
        isLoading: getStudysetIsLoading,
    } = useGetStudysetById(studysetId, false);

    const navigate = useNavigate();

    const handleMarkAllAsComplete = (confirm: boolean | undefined) => {
        if (studyset?.studies && confirm) {
            setGivenStudyStatusesAsComplete((studyset.studies || []) as string[]);
        }
        setMarkAllAsCompleteConfirmationDialogIsOpen(false);
    };

    const allStudiesAreComplete = useMemo(() => {
        return (
            extractionSummary.total > 0 && extractionSummary.completed === extractionSummary.total
        );
    }, [extractionSummary.completed, extractionSummary.total]);

    return (
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
                                    getPercentageComplete(extractionSummary) === 100
                                        ? 'success'
                                        : 'secondary'
                                }
                            />
                        </Box>
                        <Typography gutterBottom variant="h5" sx={{ marginRight: '40px' }}>
                            {studyset?.name || ''}
                        </Typography>

                        <Box sx={ProjectComponentsStyles.statusContainer}>
                            <Box sx={ProjectComponentsStyles.statusIconContainer}>
                                <QuestionMarkIcon sx={ExtractionStepStyles.uncategorizedIcon} />
                                <Typography sx={{ color: 'warning.dark' }}>
                                    {extractionSummary.uncategorized} uncategorized
                                </Typography>
                            </Box>
                            <Box sx={ProjectComponentsStyles.statusIconContainer}>
                                <BookmarkIcon sx={ExtractionStepStyles.saveForLater} />
                                <Typography sx={{ color: 'info.main' }}>
                                    {extractionSummary.savedForLater} saved for later
                                </Typography>
                            </Box>
                            <Box sx={ProjectComponentsStyles.statusIconContainer}>
                                <CheckIcon sx={ExtractionStepStyles.checkIcon} />
                                <Typography sx={{ color: 'success.main' }}>
                                    {extractionSummary.completed} completed
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
                            color={disabled ? 'primary' : 'secondary'}
                            onClick={() => navigate(`/projects/${projectId}/extraction`)}
                            variant="text"
                        >
                            {disabled ? 'view extraction' : 'continue editing'}
                        </Button>
                        <ConfirmationDialog
                            onCloseDialog={handleMarkAllAsComplete}
                            rejectText="Cancel"
                            confirmText="Mark all as complete"
                            isOpen={markAllAsCompleteConfirmationDialogIsOpen}
                            dialogTitle="Are you sure you want to mark all the studies as complete?"
                            dialogMessage="You can skip reviewing to expedite the process, but any studies you have not reviewed may have incomplete or inaccurate metadata or coordinates."
                        />
                        <Button
                            sx={{
                                display: allStudiesAreComplete ? 'none' : 'block',
                            }}
                            onClick={() => setMarkAllAsCompleteConfirmationDialogIsOpen(true)}
                            color="success"
                            disabled={disabled}
                        >
                            Mark all as complete
                        </Button>
                    </CardActions>
                </StateHandlerComponent>
            </Card>
        </Box>
    );
};

export default ExtractionStepCard;
