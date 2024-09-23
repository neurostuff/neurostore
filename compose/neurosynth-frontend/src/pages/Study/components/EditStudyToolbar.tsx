import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import CheckIcon from '@mui/icons-material/Check';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import { Box, CircularProgress, IconButton, Tooltip, Typography } from '@mui/material';
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
            <Box sx={EditStudyToolbarStyles.toolbarContainer}>
                <Box sx={EditStudyToolbarStyles.header}>Toolbar</Box>
                <Box
                    sx={{
                        padding: '10px',
                    }}
                >
                    {!isViewOnly && (
                        <>
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
                            </Box>
                        </>
                    )}

                    {isLoading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                            <ProgressLoader
                                sx={{ width: '30px !important', height: '30px !important' }}
                            />
                        </Box>
                    ) : isError ? (
                        <Typography sx={{ width: '42px' }} variant="body2" color="error">
                            There was an error
                        </Typography>
                    ) : (
                        <>
                            <Box sx={{ marginBottom: '1rem' }}>
                                <Tooltip
                                    placement="right"
                                    title={
                                        hasPrevStudies
                                            ? 'Go to previous study'
                                            : 'No previous study'
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
                                                    color: hasPrevStudies ? 'primary.main' : 'gray',
                                                }}
                                            />
                                        </IconButton>
                                    </span>
                                </Tooltip>
                            </Box>
                            <Box>
                                <Tooltip
                                    placement="right"
                                    title={hasNextStudies ? 'Go to next study' : 'No next study'}
                                >
                                    {/* tooltip cannot act on a disabled element so we need to add a span here */}
                                    <span>
                                        <IconButton
                                            disabled={!hasNextStudies}
                                            onClick={handleMoveToNextStudy}
                                        >
                                            <ArrowForwardIcon
                                                sx={{
                                                    color: hasNextStudies ? 'primary.main' : 'gray',
                                                }}
                                            />
                                        </IconButton>
                                    </span>
                                </Tooltip>
                            </Box>
                        </>
                    )}
                </Box>
            </Box>
        </Box>
    );
};

export default EditStudyToolbar;
