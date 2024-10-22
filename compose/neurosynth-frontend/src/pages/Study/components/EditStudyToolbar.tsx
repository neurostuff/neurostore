import { Check, KeyboardArrowLeft, KeyboardArrowRight } from '@mui/icons-material';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import QuestionMark from '@mui/icons-material/QuestionMark';
import SaveIcon from '@mui/icons-material/Save';
import { Box, Button, ButtonGroup, CircularProgress, IconButton, Tooltip } from '@mui/material';
import ConfirmationDialog from 'components/Dialogs/ConfirmationDialog';
import ProgressLoader from 'components/ProgressLoader';
import GlobalStyles from 'global.styles';
import { hasUnsavedStudyChanges, unsetUnloadHandler } from 'helpers/BeforeUnload.helpers';
import { useGetExtractionSummary, useGetStudysetById, useUserCanEdit } from 'hooks';
import { StudyReturn } from 'neurostore-typescript-sdk';
import {
    IExtractionTableState,
    retrieveExtractionTableState,
} from 'pages/Extraction/components/ExtractionTable.helpers';
import { EExtractionStatus } from 'pages/Extraction/ExtractionPage';
import { IProjectPageLocationState } from 'pages/Project/ProjectPage';
import {
    useProjectExtractionAddOrUpdateStudyListStatus,
    useProjectExtractionStudysetId,
    useProjectExtractionStudyStatus,
    useProjectId,
    useProjectUser,
} from 'pages/Project/store/ProjectStore';
import { useStudyId } from 'pages/Study/store/StudyStore';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useSaveStudy from 'pages/Study/hooks/useSaveStudy';
import EditStudySwapVersionButton from 'pages/Study/components/EditStudySwapVersionButton';
import EditStudyToolbarStyles from './EditStudyToolbar.styles';

const EditStudyToolbar: React.FC<{ isViewOnly?: boolean }> = ({ isViewOnly = false }) => {
    const [confirmationDialogState, setConfirmationDialogState] = useState<{
        isOpen: boolean;
        action: 'PREV' | 'NEXT' | 'COMPLETE' | undefined;
    }>({
        isOpen: false,
        action: undefined,
    });
    const { isLoading: saveStudyIsLoading, hasEdits, handleSave } = useSaveStudy();
    const navigate = useNavigate();

    const projectId = useProjectId();
    const extractionSummary = useGetExtractionSummary(projectId || '');

    const studyId = useStudyId();
    const extractionStatus = useProjectExtractionStudyStatus(studyId || '');

    const user = useProjectUser();
    const canEdit = useUserCanEdit(user ?? undefined);

    const studysetId = useProjectExtractionStudysetId();
    const { data, isLoading, isError } = useGetStudysetById(studysetId || '', true);

    // derived from the extraction table
    const [extractionTableState, setExtractionTableState] = useState<IExtractionTableState>({
        columnFilters: [],
        sorting: [],
        studies: [],
    });

    useEffect(() => {
        if (isLoading || isError) return;
        const stateFromSessionStorage = retrieveExtractionTableState(projectId);
        if (!stateFromSessionStorage) {
            setExtractionTableState((prev) => ({
                ...prev,
                studies: (data?.studies || []).map((study) => (study as StudyReturn).id as string),
            }));
        } else {
            setExtractionTableState(stateFromSessionStorage);
        }
    }, [data?.studies, isError, isLoading, projectId]);

    const updateStudyListStatus = useProjectExtractionAddOrUpdateStudyListStatus();

    const handleUpdateExtractionStatus = (status: EExtractionStatus) => {
        if (studyId) {
            updateStudyListStatus(studyId, status);
        }
    };

    const handleMoveToPreviousStudy = () => {
        const index = extractionTableState.studies.indexOf(studyId || '');
        const prevId = extractionTableState.studies[index - 1];
        if (!prevId) throw new Error('no previous study');

        const hasUnsavedChanges = hasUnsavedStudyChanges();
        if (hasUnsavedChanges) {
            setConfirmationDialogState({
                isOpen: true,
                action: 'PREV',
            });
            return;
        }

        canEdit
            ? navigate(`/projects/${projectId}/extraction/studies/${prevId}/edit`)
            : navigate(`/projects/${projectId}/extraction/studies/${prevId}`);
    };

    const handleMoveToNextStudy = () => {
        const index = extractionTableState.studies.indexOf(studyId || '');
        const nextId = extractionTableState.studies[index + 1];
        if (!nextId) throw new Error('no next study');

        const hasUnsavedChanges = hasUnsavedStudyChanges();
        if (hasUnsavedChanges) {
            setConfirmationDialogState({
                isOpen: true,
                action: 'NEXT',
            });
            return;
        }

        canEdit
            ? navigate(`/projects/${projectId}/extraction/studies/${nextId}/edit`)
            : navigate(`/projects/${projectId}/extraction/studies/${nextId}`);
    };

    const handleMoveToComplete = () => {
        const hasUnsavedChanges = hasUnsavedStudyChanges();
        if (hasUnsavedChanges) {
            setConfirmationDialogState({
                isOpen: true,
                action: 'COMPLETE',
            });
            return;
        }

        navigate(`/projects/${projectId}/project`, {
            state: {
                projectPage: {
                    scrollToMetaAnalysisProceed: true,
                },
            } as IProjectPageLocationState,
        });
    };

    const handleConfirmationDialogClose = (ok: boolean | undefined) => {
        if (!ok) {
            setConfirmationDialogState({
                isOpen: false,
                action: undefined,
            });
        } else {
            unsetUnloadHandler('study');
            unsetUnloadHandler('annotation');
            switch (confirmationDialogState.action) {
                case 'PREV':
                    handleMoveToPreviousStudy();
                    break;
                case 'NEXT':
                    handleMoveToNextStudy();
                    break;
                case 'COMPLETE':
                    handleMoveToComplete();
                    break;
                default:
                    return;
            }
            setConfirmationDialogState({
                isOpen: false,
                action: undefined,
            });
        }
    };

    const percentageCompleteString = useMemo((): string => {
        if (extractionSummary.total === 0) return '0 / 0';
        return `${extractionSummary.completed} / ${extractionSummary.total}`;
    }, [extractionSummary.completed, extractionSummary.total]);

    const percentageComplete = useMemo((): number => {
        if (extractionSummary.total === 0) return 0;
        const percentageComplete = (extractionSummary.completed / extractionSummary.total) * 100;
        return Math.floor(percentageComplete);
    }, [extractionSummary.completed, extractionSummary.total]);

    const isComplete = useMemo(() => {
        return (
            extractionSummary.completed === extractionSummary.total && extractionSummary.total > 0
        );
    }, [extractionSummary.completed, extractionSummary.total]);

    const hasPrevStudies = useMemo(() => {
        const studies = extractionTableState.studies;
        const index = studies.indexOf(studyId || '');
        return index - 1 >= 0;
    }, [extractionTableState.studies, studyId]);

    const hasNextStudies = useMemo(() => {
        const studies = extractionTableState.studies;
        const index = studies.indexOf(studyId || '');
        return index + 1 < studies.length;
    }, [extractionTableState.studies, studyId]);

    return (
        <Box sx={EditStudyToolbarStyles.stickyContainer}>
            {!isViewOnly && (
                <Box sx={EditStudyToolbarStyles.toolbarContainer}>
                    <ConfirmationDialog
                        isOpen={confirmationDialogState.isOpen}
                        dialogTitle="You have unsaved changes"
                        dialogMessage="Are you sure you want to continue? You'll lose your unsaved changes"
                        onCloseDialog={handleConfirmationDialogClose}
                        rejectText="Cancel"
                        confirmText="Continue"
                    />
                    <Box sx={EditStudyToolbarStyles.header}>Toolbar</Box>
                    <Box
                        sx={{
                            padding: '10px',
                        }}
                    >
                        <Box sx={{ marginBottom: '1rem' }}>
                            {isComplete ? (
                                <Tooltip
                                    placement="left"
                                    title="You're done! Click this button to continue to the next phase"
                                >
                                    <Box>
                                        <IconButton
                                            onClick={handleMoveToComplete}
                                            sx={GlobalStyles.colorPulseAnimation}
                                        >
                                            <DoneAllIcon color="success" />
                                        </IconButton>
                                    </Box>
                                </Tooltip>
                            ) : (
                                <Tooltip
                                    placement="left"
                                    title={`${percentageCompleteString} studies marked as complete`}
                                >
                                    <Box>
                                        <Box sx={EditStudyToolbarStyles.showProgress}>
                                            {percentageComplete}%
                                        </Box>

                                        <CircularProgress
                                            sx={{
                                                backgroundColor: '#ededed',
                                                borderRadius: '50%',
                                            }}
                                            variant="determinate"
                                            value={percentageComplete}
                                        />
                                    </Box>
                                </Tooltip>
                            )}
                        </Box>
                        <Box sx={{ marginBottom: '0.5rem' }}>
                            <EditStudySwapVersionButton />
                        </Box>
                        <Box sx={{ marginBottom: '1rem' }}>
                            <Tooltip
                                title={!hasEdits ? 'No edits to save' : 'Save'}
                                placement="left"
                            >
                                <Box>
                                    <Button
                                        disabled={!hasEdits}
                                        disableElevation
                                        onClick={handleSave}
                                        variant="outlined"
                                        color="primary"
                                        sx={{
                                            width: '40px',
                                            maxWidth: '40px',
                                            minWidth: '40px',
                                            height: '40px',
                                            padding: 0,
                                        }}
                                    >
                                        {saveStudyIsLoading ? (
                                            <ProgressLoader color="secondary" size={20} />
                                        ) : (
                                            <SaveIcon />
                                        )}
                                    </Button>
                                </Box>
                            </Tooltip>
                        </Box>
                        <Box>
                            <ButtonGroup
                                color="info"
                                orientation="vertical"
                                sx={{ minWidth: '0px', marginBottom: '1rem' }}
                            >
                                <Tooltip title="Mark as uncategorized" placement="left">
                                    <Button
                                        onClick={() =>
                                            handleUpdateExtractionStatus(
                                                EExtractionStatus.UNCATEGORIZED
                                            )
                                        }
                                        sx={{ minWidth: '0', width: '40px', height: '40px' }}
                                        disableElevation
                                        color="warning"
                                        variant={
                                            extractionStatus?.status ===
                                            EExtractionStatus.UNCATEGORIZED
                                                ? 'contained'
                                                : 'outlined'
                                        }
                                    >
                                        <QuestionMark />
                                    </Button>
                                </Tooltip>
                                <Tooltip title="Save for later" placement="left">
                                    <Button
                                        onClick={() =>
                                            handleUpdateExtractionStatus(
                                                EExtractionStatus.SAVEDFORLATER
                                            )
                                        }
                                        sx={{ minWidth: '0', width: '40px', height: '40px' }}
                                        disableElevation
                                        variant={
                                            extractionStatus?.status ===
                                            EExtractionStatus.SAVEDFORLATER
                                                ? 'contained'
                                                : 'outlined'
                                        }
                                    >
                                        <BookmarkIcon />
                                    </Button>
                                </Tooltip>
                                <Tooltip title="Complete" placement="left">
                                    <Button
                                        onClick={() =>
                                            handleUpdateExtractionStatus(
                                                EExtractionStatus.COMPLETED
                                            )
                                        }
                                        sx={{ minWidth: '0', width: '40px', height: '40px' }}
                                        disableElevation
                                        color="success"
                                        variant={
                                            extractionStatus?.status === EExtractionStatus.COMPLETED
                                                ? 'contained'
                                                : 'outlined'
                                        }
                                    >
                                        <Check />
                                    </Button>
                                </Tooltip>
                            </ButtonGroup>
                        </Box>
                        <Box>
                            <ButtonGroup
                                color="info"
                                orientation="vertical"
                                sx={{ minWidth: '0px' }}
                            >
                                <Tooltip
                                    placement="right"
                                    title={
                                        hasPrevStudies ? `go to previous study` : `no more studies`
                                    }
                                >
                                    {/* need this box as a wrapper because tooltip will not act on a disabled element */}
                                    <Box>
                                        <Button
                                            onClick={handleMoveToPreviousStudy}
                                            disableElevation
                                            disabled={!hasPrevStudies}
                                            sx={{ height: '40px', width: '40px', minWidth: '0' }}
                                        >
                                            <KeyboardArrowLeft />
                                        </Button>
                                    </Box>
                                </Tooltip>
                                <Tooltip
                                    placement="right"
                                    title={hasNextStudies ? `go to next study` : `no more studies`}
                                >
                                    {/* need this box as a wrapper because tooltip will not act on a disabled element */}
                                    <Box>
                                        <Button
                                            onClick={handleMoveToNextStudy}
                                            disableElevation
                                            disabled={!hasNextStudies}
                                            sx={{ height: '40px', width: '40px', minWidth: '0' }}
                                        >
                                            <KeyboardArrowRight />
                                        </Button>
                                    </Box>
                                </Tooltip>
                            </ButtonGroup>
                        </Box>
                    </Box>
                </Box>
            )}
        </Box>
    );
};

export default EditStudyToolbar;
