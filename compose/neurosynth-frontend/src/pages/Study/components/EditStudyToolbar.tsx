import BookmarkIcon from '@mui/icons-material/Bookmark';
import CheckIcon from '@mui/icons-material/Check';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import {
    Box,
    Button,
    ButtonGroup,
    CircularProgress,
    Fab,
    IconButton,
    Tooltip,
    Typography,
} from '@mui/material';
import { ColumnFiltersState, SortingState } from '@tanstack/react-table';
import ProgressLoader from 'components/ProgressLoader';
import GlobalStyles from 'global.styles';
import { useGetExtractionSummary, useGetStudysetById, useUserCanEdit } from 'hooks';
import { StudyReturn } from 'neurostore-typescript-sdk';
import { EExtractionStatus } from 'pages/Extraction/ExtractionPage';
import { IProjectPageLocationState } from 'pages/Project/ProjectPage';
import {
    useProjectExtractionAddOrUpdateStudyListStatus,
    useProjectExtractionStudysetId,
    useProjectExtractionStudyStatus,
    useProjectId,
    useProjectMetaAnalysisCanEdit,
    useProjectUser,
} from 'pages/Project/store/ProjectStore';
import { useStudyId } from 'pages/Study/store/StudyStore';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import EditStudyToolbarStyles from './EditStudyToolbar.styles';

const EditStudyToolbar: React.FC<{ isViewOnly?: boolean }> = ({ isViewOnly = false }) => {
    const navigate = useNavigate();
    const canEditMetaAnalyses = useProjectMetaAnalysisCanEdit();

    const projectId = useProjectId();
    const extractionSummary = useGetExtractionSummary(projectId || '');

    const studyId = useStudyId();
    const extractionStatus = useProjectExtractionStudyStatus(studyId || '');

    const user = useProjectUser();
    const canEdit = useUserCanEdit(user ?? undefined);

    const studysetId = useProjectExtractionStudysetId();
    const { data, isLoading, isError } = useGetStudysetById(studysetId || '', true);

    // derived from the extraction table
    const [extractionTableState, setExtractionTableState] = useState<{
        columnFilters: ColumnFiltersState;
        sorting: SortingState;
        studies: string[];
    }>({
        columnFilters: [],
        sorting: [],
        studies: [],
    });

    useEffect(() => {
        const stateFromSessionStorage = sessionStorage.getItem(`${projectId}-extraction-table`);
        if (!stateFromSessionStorage) {
            setExtractionTableState((prev) => ({
                ...prev,
                studies: (data?.studies || []).map((study) => (study as StudyReturn).id as string),
            }));
        } else {
            try {
                const parsedState = JSON.parse(stateFromSessionStorage) as {
                    columnFilters: ColumnFiltersState;
                    sorting: SortingState;
                    studies: string[];
                };
                setExtractionTableState(parsedState);
            } catch (e) {
                throw new Error('couldnt parse table state from session storage');
            }
        }
    }, [data?.studies, projectId]);

    const updateStudyListStatus = useProjectExtractionAddOrUpdateStudyListStatus();

    const handleClickStudyListStatus = (status: EExtractionStatus) => {
        if (studyId) {
            updateStudyListStatus(studyId, status);
        }
    };

    const handleMoveToPreviousStudy = () => {
        const index = extractionTableState.studies.indexOf(studyId || '');
        const prevId = extractionTableState.studies[index - 1];
        if (!prevId) throw new Error('no previous study');
        canEdit
            ? navigate(`/projects/${projectId}/extraction/studies/${prevId}/edit`)
            : navigate(`/projects/${projectId}/extraction/studies/${prevId}`);
    };

    const handleMoveToNextStudy = () => {
        const index = extractionTableState.studies.indexOf(studyId || '');
        const nextId = extractionTableState.studies[index + 1];
        if (!nextId) throw new Error('no next study');
        canEdit
            ? navigate(`/projects/${projectId}/extraction/studies/${nextId}/edit`)
            : navigate(`/projects/${projectId}/extraction/studies/${nextId}`);
    };

    const handleContinueToMetaAnalysisCreation = () => {
        if (canEditMetaAnalyses) {
            navigate(`/projects/${projectId}/meta-analyses`);
        } else {
            navigate(`/projects/${projectId}/edit`, {
                state: {
                    projectPage: {
                        scrollToMetaAnalysisProceed: true,
                    },
                } as IProjectPageLocationState,
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
                    <Box sx={EditStudyToolbarStyles.header}>Toolbar</Box>
                    <Box
                        sx={{
                            padding: '10px',
                        }}
                    >
                        <Box sx={{ marginBottom: '1rem' }}>
                            {isComplete ? (
                                <Tooltip
                                    placement="right"
                                    title="You're done! Click this button to continue to the next phase"
                                >
                                    <Box>
                                        <IconButton
                                            onClick={handleContinueToMetaAnalysisCreation}
                                            sx={GlobalStyles.colorPulseAnimation}
                                        >
                                            <DoneAllIcon color="success" />
                                        </IconButton>
                                    </Box>
                                </Tooltip>
                            ) : (
                                <Tooltip
                                    placement="right"
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
                        <Box sx={{ marginBottom: '1rem' }}>
                            <Fab color="secondary" size="small" sx={{ boxShadow: 'none' }}>
                                <SwapHorizIcon />
                            </Fab>
                        </Box>
                        <Box>
                            <ButtonGroup orientation="vertical">
                                <Button
                                    onClick={() =>
                                        handleClickStudyListStatus(EExtractionStatus.COMPLETED)
                                    }
                                    sx={{ padding: '0.5rem 0', height: '40px' }}
                                    disableElevation
                                    variant={
                                        extractionStatus?.status === EExtractionStatus.COMPLETED
                                            ? 'contained'
                                            : 'outlined'
                                    }
                                >
                                    <CheckIcon />
                                </Button>
                                <Button
                                    onClick={() =>
                                        handleClickStudyListStatus(EExtractionStatus.SAVEDFORLATER)
                                    }
                                    sx={{ padding: '0.5rem 0', height: '40px' }}
                                    disableElevation
                                    variant={
                                        extractionStatus?.status === EExtractionStatus.SAVEDFORLATER
                                            ? 'contained'
                                            : 'outlined'
                                    }
                                >
                                    <BookmarkIcon />
                                </Button>
                            </ButtonGroup>
                        </Box>

                        {/* <Box sx={{ marginBottom: '1rem' }}>
                                <Tooltip placement="right" title="move to completed">
                                    <IconButton
                                        sx={{
                                            backgroundColor:
                                                extractionStatus?.status ===
                                                EExtractionStatus.COMPLETED
                                                    ? '#ebebeb'
                                                    : '',
                                        }}
                                        onClick={() =>
                                            handleClickStudyListStatus(EExtractionStatus.COMPLETED)
                                        }
                                    >
                                        <CheckIcon color="success" />
                                    </IconButton>
                                </Tooltip>
                            </Box>
                            <Box sx={{ marginBottom: '1rem' }}>
                                <Tooltip placement="right" title="move to save for later">
                                    <IconButton
                                        sx={{
                                            backgroundColor:
                                                extractionStatus?.status ===
                                                EExtractionStatus.SAVEDFORLATER
                                                    ? '#ebebeb'
                                                    : '',
                                        }}
                                        onClick={() =>
                                            handleClickStudyListStatus(
                                                EExtractionStatus.SAVEDFORLATER
                                            )
                                        }
                                    >
                                        <BookmarkIcon color="info" />
                                    </IconButton>
                                </Tooltip>
                            </Box> */}
                        {/* <Box sx={{ marginBottom: '1rem' }}>
                        <Tooltip
                            placement="right"
                            title={
                                hasPrevStudies
                                    ? `go to previous ${currSelectedChipText} study`
                                    : `no previous ${currSelectedChipText} study`
                            }
                        >
                            <span>
                                <IconButton
                                    disabled={!hasPrevStudies}
                                    onClick={handleMoveToPreviousStudy}
                                >
                                    <ArrowBackIcon
                                        sx={{
                                            color: hasPrevStudies
                                                ? prevNextArrowColor
                                                : 'muted.dark',
                                        }}
                                    />
                                </IconButton>
                            </span>
                        </Tooltip>
                    </Box>
                    <Box>
                        <Tooltip
                            placement="right"
                            title={
                                hasNextStudies
                                    ? `go to next ${currSelectedChipText} study`
                                    : `no next ${currSelectedChipText} study`
                            }
                        >
                            <span>
                                <IconButton
                                    disabled={!hasNextStudies}
                                    onClick={handleMoveToNextStudy}
                                >
                                    <ArrowForwardIcon
                                        sx={{
                                            color: hasNextStudies
                                                ? prevNextArrowColor
                                                : 'muted.dark',
                                        }}
                                    />
                                </IconButton>
                            </span>
                        </Tooltip>
                    </Box> */}
                    </Box>
                </Box>
            )}
        </Box>
    );
};

export default EditStudyToolbar;
