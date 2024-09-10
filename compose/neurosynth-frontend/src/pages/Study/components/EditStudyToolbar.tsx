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
} from '@mui/material';
import GlobalStyles from 'global.styles';
import { useGetExtractionSummary, useGetStudysetById, useUserCanEdit } from 'hooks';
import { StudyReturn } from 'neurostore-typescript-sdk';
import { EExtractionStatus } from 'pages/Extraction/ExtractionPage';
import { IProjectPageLocationState } from 'pages/Project/ProjectPage';
import {
    useProjectExtractionAddOrUpdateStudyListStatus,
    useProjectExtractionStudyStatus,
    useProjectExtractionStudyStatusList,
    useProjectExtractionStudysetId,
    useProjectId,
    useProjectMetaAnalysisCanEdit,
    useProjectUser,
} from 'pages/Project/store/ProjectStore';
import { useStudyId } from 'pages/Study/store/StudyStore';
import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import EditStudyToolbarStyles from './EditStudyToolbar.styles';

const getCurrSelectedChipText = (selectedChip: EExtractionStatus) => {
    switch (selectedChip) {
        case EExtractionStatus.UNCATEGORIZED:
            return 'uncategorized';
        case EExtractionStatus.COMPLETED:
            return 'completed';
        case EExtractionStatus.SAVEDFORLATER:
            return 'saved for later';
        default:
            return 'uncategorized';
    }
};

const getCurrSelectedChip = (projectId: string | undefined) => {
    return (
        (localStorage.getItem(`SELECTED_CHIP-${projectId}`) as EExtractionStatus) ||
        EExtractionStatus.UNCATEGORIZED
    );
};

const EditStudyToolbar: React.FC<{ isViewOnly?: boolean }> = ({ isViewOnly = false }) => {
    const projectId = useProjectId();
    const studyId = useStudyId();
    const extractionStatus = useProjectExtractionStudyStatus(studyId || '');
    const extractionSummary = useGetExtractionSummary(projectId || '');
    const studysetId = useProjectExtractionStudysetId();
    // nested msut be true so that we maintain to alphabetical study order
    // if nested is false, we do not have access to study names and so will be given study Ids in random order
    const { data: studyset } = useGetStudysetById(studysetId, true);
    const studyStatusList = useProjectExtractionStudyStatusList();
    const navigate = useNavigate();
    const canEditMetaAnalyses = useProjectMetaAnalysisCanEdit();
    const user = useProjectUser();
    const canEdit = useUserCanEdit(user ?? undefined);

    const updateStudyListStatus = useProjectExtractionAddOrUpdateStudyListStatus();

    const handleClickStudyListStatus = (status: EExtractionStatus) => {
        if (studyId) {
            updateStudyListStatus(studyId, status);
        }
    };

    const getValidPrevStudyId = useCallback((): string | undefined => {
        if (!studyset?.studies) return undefined;

        const CURR_SELECTED_CHIP_STATUS = getCurrSelectedChip(projectId);
        const currStudyIndex = (studyset.studies || []).findIndex(
            (study) => (study as StudyReturn)?.id === studyId
        );
        if (currStudyIndex < 0) return undefined;
        const map = new Map<string, EExtractionStatus>();
        studyStatusList.forEach((studyStatus) => {
            map.set(studyStatus.id, studyStatus.status);
        });

        // go through all previous studies to find the next one before this current selected study that has the current selected chip status.
        // This will also take care of the case where the current study selected is the first one
        for (let i = currStudyIndex - 1; i >= 0; i--) {
            const aStudy = studyset.studies[i] as StudyReturn;
            if (!aStudy?.id) return undefined;
            const aStudyStatus = map.get(aStudy.id) || EExtractionStatus.UNCATEGORIZED;

            if (aStudyStatus === CURR_SELECTED_CHIP_STATUS) return aStudy.id;
        }
        return undefined;
    }, [projectId, studyId, studyStatusList, studyset]);

    const getValidNextStudyId = useCallback((): string | undefined => {
        if (!studyset?.studies) return undefined;

        const CURR_SELECTED_CHIP_STATUS = getCurrSelectedChip(projectId);
        const currStudyIndex = (studyset.studies || []).findIndex(
            (study) => (study as StudyReturn)?.id === studyId
        );
        if (currStudyIndex < 0) return undefined;
        const map = new Map<string, EExtractionStatus>();
        studyStatusList.forEach((studyStatus) => {
            map.set(studyStatus.id, studyStatus.status);
        });

        for (let i = currStudyIndex + 1; i <= studyset.studies.length; i++) {
            const aStudy = studyset.studies[i] as StudyReturn;
            if (!aStudy?.id) return undefined;
            const aStudyStatus = map.get(aStudy.id) || EExtractionStatus.UNCATEGORIZED;

            if (aStudyStatus === CURR_SELECTED_CHIP_STATUS) return aStudy.id;
        }
        return undefined;
    }, [projectId, studyId, studyStatusList, studyset]);

    const handleMoveToPreviousStudy = () => {
        const prevId = getValidPrevStudyId();
        if (prevId) {
            canEdit
                ? navigate(`/projects/${projectId}/extraction/studies/${prevId}/edit`)
                : navigate(`/projects/${projectId}/extraction/studies/${prevId}`);
        } else {
            throw new Error('no studies before this one');
        }
    };

    const handleMoveToNextStudy = () => {
        const nextId = getValidNextStudyId();
        if (nextId) {
            canEdit
                ? navigate(`/projects/${projectId}/extraction/studies/${nextId}/edit`)
                : navigate(`/projects/${projectId}/extraction/studies/${nextId}`);
        } else {
            throw new Error('no studies after this one');
        }
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
        return getValidPrevStudyId() !== undefined;
    }, [getValidPrevStudyId]);

    const hasNextStudies = useMemo(() => {
        return getValidNextStudyId() !== undefined;
    }, [getValidNextStudyId]);

    const currSelectedChipText = useMemo(() => {
        const currSelectedChip = (localStorage.getItem(`SELECTED_CHIP-${projectId}`) ||
            EExtractionStatus.UNCATEGORIZED) as EExtractionStatus;
        return getCurrSelectedChipText(currSelectedChip);
    }, [projectId]);

    const prevNextArrowColor = useMemo(() => {
        const currSelectedChip = (localStorage.getItem(`SELECTED_CHIP-${projectId}`) ||
            EExtractionStatus.UNCATEGORIZED) as EExtractionStatus;
        switch (currSelectedChip) {
            case EExtractionStatus.UNCATEGORIZED:
                return 'warning.main';
            case EExtractionStatus.SAVEDFORLATER:
                return 'info.main';
            case EExtractionStatus.COMPLETED:
                return 'success.main';
            default:
                return 'warning.main';
        }
    }, [projectId]);

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
