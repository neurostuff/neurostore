import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import CheckIcon from '@mui/icons-material/Check';
import { Box, CircularProgress, IconButton, Tooltip, Typography } from '@mui/material';
import { useGetStudysetById } from 'hooks';
import useGetExtractionSummary from 'hooks/useGetExtractionSummary';
import { useSnackbar } from 'notistack';
import { ESelectedChip } from 'pages/ExtractionPage/ExtractionPage';
import {
    useProjectExtractionAddOrUpdateStudyListStatus,
    useProjectExtractionStudyStatus,
    useProjectExtractionStudyStatusList,
    useProjectExtractionStudysetId,
    useProjectId,
} from 'pages/Projects/ProjectPage/ProjectStore';
import { useMemo } from 'react';
import { useHistory } from 'react-router-dom';

const getCurrSelectedChipText = (selectedChip: ESelectedChip) => {
    switch (selectedChip) {
        case ESelectedChip.UNCATEGORIZED:
            return 'uncategorized';
        case ESelectedChip.COMPLETED:
            return 'completed';
        case ESelectedChip.SAVEDFORLATER:
            return 'saved for later';
        default:
            return 'uncategorized';
    }
};

const FloatingStatusButtons: React.FC<{ studyId: string }> = (props) => {
    const projectId = useProjectId();
    const extractionStatus = useProjectExtractionStudyStatus(props.studyId);
    const extractionSummary = useGetExtractionSummary(projectId || '');
    const studysetId = useProjectExtractionStudysetId();
    const { data: studyset } = useGetStudysetById(studysetId, false);
    const { enqueueSnackbar } = useSnackbar();
    const studyStatusList = useProjectExtractionStudyStatusList();
    const history = useHistory();

    const updateStudyListStatus = useProjectExtractionAddOrUpdateStudyListStatus();

    const handleClickStudyListStatus = (status: 'COMPLETE' | 'SAVEFORLATER') => {
        if (props.studyId) {
            updateStudyListStatus(props.studyId, status);
        }
    };

    const handleMoveToPreviousStudy = () => {
        if (!studyset?.studies) return;

        const CURR_SELECTED_CHIP_STATUS =
            (localStorage.getItem('SELECTED_CHIP') as ESelectedChip) || ESelectedChip.UNCATEGORIZED;

        const currStudyIndex = (studyset.studies || []).findIndex(
            (study) => study === props.studyId
        );
        if (currStudyIndex < 0) {
            enqueueSnackbar('there was an error', {
                variant: 'error',
            });
            return;
        }

        const map = new Map<string, 'COMPLETE' | 'SAVEFORLATER'>();
        studyStatusList.forEach((studyStatus) => {
            map.set(studyStatus.id, studyStatus.status);
        });

        // go through all previous studies to find the next one before this current selected study that has CURR_SELECTED_CHIP status
        // this will also take care of the case where the current study selected is the first one
        for (let i = currStudyIndex - 1; i >= 0; i--) {
            const aStudyId = studyset.studies[i] as string;
            const aStudyStatus = map.get(aStudyId) || ESelectedChip.UNCATEGORIZED;

            if (aStudyStatus === CURR_SELECTED_CHIP_STATUS) {
                history.push(`/projects/${projectId}/extraction/studies/${aStudyId}`);
                return;
            }
        }

        enqueueSnackbar(
            `There are no ${getCurrSelectedChipText(
                CURR_SELECTED_CHIP_STATUS
            )} studies before this one`,
            { variant: 'info' }
        );
        return;
    };

    const handleMoveToNextStudy = () => {};

    const percentageComplete = useMemo((): number => {
        if (extractionSummary.total === 0) return 0;
        const percentageComplete = (extractionSummary.completed / extractionSummary.total) * 100;
        return Math.round(percentageComplete);
    }, [extractionSummary.completed, extractionSummary.total]);

    return (
        <Box
            sx={{
                position: 'sticky',
                top: 15,
            }}
        >
            <Box
                sx={{
                    position: 'absolute',
                    right: 'calc(-8% - 18px)',
                    borderRadius: '4px',
                    border: '2px solid',
                    borderColor: 'primary.main',
                }}
            >
                <Box
                    sx={{
                        color: 'primary.contrastText',
                        backgroundColor: 'primary.main',
                        fontSize: '0.8rem',
                        textAlign: 'center',
                        padding: '10px 0',
                    }}
                >
                    Toolbar
                </Box>
                <Box
                    sx={{
                        padding: '10px',
                    }}
                >
                    <Box sx={{ marginBottom: '1rem' }}>
                        <Tooltip placement="right" title="percentage of studies marked as complete">
                            <Box>
                                <Box
                                    sx={{
                                        position: 'absolute',
                                        zIndex: 1,
                                        width: '40px',
                                        height: '40px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: 'primary.main',
                                    }}
                                >
                                    {percentageComplete}%
                                </Box>

                                <CircularProgress
                                    sx={{ backgroundColor: '#ededed', borderRadius: '50%' }}
                                    variant="determinate"
                                    value={percentageComplete}
                                />
                            </Box>
                        </Tooltip>
                    </Box>
                    <Box sx={{ marginBottom: '1rem' }}>
                        <Tooltip placement="right" title="move to completed">
                            <IconButton
                                sx={{
                                    backgroundColor:
                                        extractionStatus?.status === 'COMPLETE' ? 'lightgray' : '',
                                    border: '1px solid lightgray',
                                }}
                                onClick={() => handleClickStudyListStatus('COMPLETE')}
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
                                        extractionStatus?.status === 'SAVEFORLATER'
                                            ? 'lightgray'
                                            : '',
                                    border: '1px solid lightgray',
                                }}
                                onClick={() => handleClickStudyListStatus('SAVEFORLATER')}
                            >
                                <BookmarkIcon color="info" />
                            </IconButton>
                        </Tooltip>
                    </Box>
                    <Box sx={{ marginBottom: '1rem' }}>
                        <Tooltip placement="right" title="go to previous study">
                            <IconButton onClick={handleMoveToPreviousStudy}>
                                <ArrowBackIcon color="secondary" />
                            </IconButton>
                        </Tooltip>
                    </Box>
                    <Box>
                        <Tooltip placement="right" title="go to next study">
                            <IconButton onClick={handleMoveToNextStudy}>
                                <ArrowForwardIcon color="secondary" />
                            </IconButton>
                        </Tooltip>
                    </Box>
                </Box>
            </Box>
        </Box>
    );
};

export default FloatingStatusButtons;
