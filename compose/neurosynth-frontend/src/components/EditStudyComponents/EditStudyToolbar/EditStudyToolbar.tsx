import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import CheckIcon from '@mui/icons-material/Check';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import { Box, CircularProgress, IconButton, Tooltip } from '@mui/material';
import { useGetStudysetById } from 'hooks';
import useGetExtractionSummary from 'hooks/useGetExtractionSummary';
import { EExtractionStatus } from 'pages/ExtractionPage/ExtractionPage';
import { IProjectPageLocationState } from 'pages/Projects/ProjectPage/ProjectPage';
import {
    useProjectExtractionAddOrUpdateStudyListStatus,
    useProjectExtractionStudyStatus,
    useProjectExtractionStudyStatusList,
    useProjectExtractionStudysetId,
    useProjectId,
    useProjectMetaAnalysisCanEdit,
} from 'pages/Projects/ProjectPage/ProjectStore';
import { useStudyId } from 'pages/Studies/StudyStore';
import { useCallback, useMemo } from 'react';
import { useHistory } from 'react-router-dom';
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

const EditStudyToolbar: React.FC = (props) => {
    const projectId = useProjectId();
    const studyId = useStudyId();
    const extractionStatus = useProjectExtractionStudyStatus(studyId || '');
    const extractionSummary = useGetExtractionSummary(projectId || '');
    const studysetId = useProjectExtractionStudysetId();
    const { data: studyset } = useGetStudysetById(studysetId, false);
    const studyStatusList = useProjectExtractionStudyStatusList();
    const history = useHistory<IProjectPageLocationState>();
    const canEditMetaAnalyses = useProjectMetaAnalysisCanEdit();

    const updateStudyListStatus = useProjectExtractionAddOrUpdateStudyListStatus();

    const handleClickStudyListStatus = (status: EExtractionStatus) => {
        if (studyId) {
            updateStudyListStatus(studyId, status);
        }
    };

    const getValidPrevStudyId = useCallback((): string | undefined => {
        if (!studyset?.studies) return undefined;

        const CURR_SELECTED_CHIP_STATUS =
            (localStorage.getItem(`SELECTED_CHIP-${projectId}`) as EExtractionStatus) ||
            EExtractionStatus.UNCATEGORIZED;

        const currStudyIndex = (studyset.studies || []).findIndex((study) => study === studyId);
        if (currStudyIndex < 0) {
            return undefined;
        }

        const map = new Map<string, EExtractionStatus>();
        studyStatusList.forEach((studyStatus) => {
            map.set(studyStatus.id, studyStatus.status);
        });

        for (let i = currStudyIndex - 1; i >= 0; i--) {
            const aStudyId = studyset.studies[i] as string;
            const aStudyStatus = map.get(aStudyId) || EExtractionStatus.UNCATEGORIZED;

            if (aStudyStatus === CURR_SELECTED_CHIP_STATUS) return aStudyId;
        }
        return undefined;
    }, [projectId, studyId, studyStatusList, studyset]);

    const getValidNextStudyId = useCallback((): string | undefined => {
        if (!studyset?.studies) return undefined;

        const CURR_SELECTED_CHIP_STATUS =
            (localStorage.getItem(`SELECTED_CHIP-${projectId}`) as EExtractionStatus) ||
            EExtractionStatus.UNCATEGORIZED;
        const currStudyIndex = (studyset.studies || []).findIndex((study) => study === studyId);
        if (currStudyIndex < 0) {
            return undefined;
        }
        const map = new Map<string, EExtractionStatus>();
        studyStatusList.forEach((studyStatus) => {
            map.set(studyStatus.id, studyStatus.status);
        });

        // go through all previous studies to find the next one before this current selected study that has CURR_SELECTED_CHIP status
        // this will also take care of the case where the current study selected is the first one
        for (let i = currStudyIndex + 1; i <= studyset.studies.length; i++) {
            const aStudyId = studyset.studies[i] as string;
            const aStudyStatus = map.get(aStudyId) || EExtractionStatus.UNCATEGORIZED;

            if (aStudyStatus === CURR_SELECTED_CHIP_STATUS) {
                return aStudyId;
            }
        }
        return undefined;
    }, [projectId, studyId, studyStatusList, studyset]);

    const handleMoveToPreviousStudy = () => {
        const prevId = getValidPrevStudyId();
        if (prevId) {
            history.push(`/projects/${projectId}/extraction/studies/${prevId}`);
        } else {
            throw new Error('no studies before this one');
        }
    };

    const handleMoveToNextStudy = () => {
        const nextId = getValidNextStudyId();
        if (nextId) {
            history.push(`/projects/${projectId}/extraction/studies/${nextId}`);
        } else {
            throw new Error('no studies after this one');
        }
    };

    const handleContinueToMetaAnalysisCreation = () => {
        if (canEditMetaAnalyses) {
            history.push(`/projects/${projectId}/meta-analyses`);
        } else {
            history.push(`/projects/${projectId}/edit`, {
                projectPage: {
                    scrollToMetaAnalysisProceed: true,
                },
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
                                        sx={EditStudyToolbarStyles.colorPulseAnimation}
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
                                        sx={{ backgroundColor: '#ededed', borderRadius: '50%' }}
                                        variant="determinate"
                                        value={percentageComplete}
                                    />
                                </Box>
                            </Tooltip>
                        )}
                    </Box>
                    <Box sx={{ marginBottom: '1rem' }}>
                        <Tooltip placement="right" title="move to completed">
                            <IconButton
                                sx={{
                                    backgroundColor:
                                        extractionStatus?.status === EExtractionStatus.COMPLETED
                                            ? 'lightgray'
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
                                        extractionStatus?.status === EExtractionStatus.SAVEDFORLATER
                                            ? 'lightgray'
                                            : '',
                                }}
                                onClick={() =>
                                    handleClickStudyListStatus(EExtractionStatus.SAVEDFORLATER)
                                }
                            >
                                <BookmarkIcon color="info" />
                            </IconButton>
                        </Tooltip>
                    </Box>
                    <Box sx={{ marginBottom: '1rem' }}>
                        <Tooltip
                            placement="right"
                            title={
                                hasPrevStudies
                                    ? `go to previous ${currSelectedChipText} study`
                                    : `no previous ${currSelectedChipText} study`
                            }
                        >
                            {/* tooltip cannot act on a disabled element so we need to add a span here */}
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
                            {/* tooltip cannot act on a disabled element so we need to add a span here */}
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
                    </Box>
                </Box>
            </Box>
        </Box>
    );
};

export default EditStudyToolbar;
