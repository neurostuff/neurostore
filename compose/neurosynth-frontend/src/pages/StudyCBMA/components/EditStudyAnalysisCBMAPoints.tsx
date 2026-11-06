import EditStudyAnalysisCBMAPointsTableContainer from 'pages/StudyCBMA/components/EditStudyAnalysisCBMAPointsTableContainer';
import { Box, Link, Tooltip, Typography } from '@mui/material';
import RelegateExtractionStudyDialog from './RelegateExtractionStudyDialog';
import { useNavigate } from 'react-router-dom';
import { useProjectId } from 'stores/projects/ProjectStore';
import { allPointsHaveCoordinates } from 'stores/study/StudyStore.helpers';
import { useCallback, useLayoutEffect, useState } from 'react';
import { useSnackbar } from 'notistack';
import { Warning, Help } from '@mui/icons-material';
import { useStudyCBMAContext } from 'pages/StudyCBMA/context/StudyCBMAContext';
import useEditAnalysisPointsHotTable from 'pages/StudyCBMA/hooks/useEditAnalysisPointsHotTable';
import EditStudyAnalysisCBMAPointSpaceAndStatistic from 'pages/StudyCBMA/components/EditStudyAnalysisCBMAPointSpaceAndStatistic';

const EditStudyAnalysisCBMAPoints = ({ analysisId }: { analysisId?: string }) => {
    const navigate = useNavigate();
    const projectId = useProjectId();
    const { enqueueSnackbar } = useSnackbar();
    const { pointsTableSeed } = useStudyCBMAContext();
    const snapshot = useEditAnalysisPointsHotTable(analysisId, pointsTableSeed);
    const [relegateExtractionStudyDialogState, setRelegateExtractionStudyDialogState] = useState(false);
    const [showRelegateCoordinatesLink, setShowRelegateCoordinatesLink] = useState(false);

    useLayoutEffect(() => {
        if (!snapshot) return;
        setShowRelegateCoordinatesLink(!allPointsHaveCoordinates(snapshot.points));
    }, [snapshot]);

    const handleAllPointsHaveCoordinates = useCallback((allPointsHaveCoordinates: boolean) => {
        setShowRelegateCoordinatesLink(!allPointsHaveCoordinates);
    }, []);

    const handleRelegateExtractionStudy = (confirm: boolean) => {
        if (confirm) {
            navigate(`/projects/${projectId}/extraction`);
            enqueueSnackbar('Study removed from extraction phase and marked as "Insufficient details"', {
                variant: 'success',
            });
        }
        setRelegateExtractionStudyDialogState(false);
    };

    return (
        <Box sx={{ marginTop: '2rem' }}>
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: { xs: 'column', md: 'row' },
                    margin: '0.5rem 0',
                }}
            >
                <Box sx={{ display: 'flex' }}>
                    <Typography sx={{ fontWeight: 'bold', marginRight: '4px' }}>Analysis Coordinates</Typography>
                    <Tooltip
                        title="To add or remove rows, right click on a cell to open the context menu. You must enter all coordinates in order to save the overall study. Please note that the ordering of points is not guaranteed."
                        placement="right"
                    >
                        <Help color="primary" />
                    </Tooltip>
                </Box>
                {showRelegateCoordinatesLink && (
                    <Box sx={{ marginLeft: { xs: 0, md: 'auto' } }}>
                        <RelegateExtractionStudyDialog
                            isOpen={relegateExtractionStudyDialogState}
                            onCloseDialog={handleRelegateExtractionStudy}
                        />
                        <Link
                            variant="body2"
                            underline="hover"
                            sx={{
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                color: 'secondary.dark',
                            }}
                            onClick={() => setRelegateExtractionStudyDialogState(true)}
                        >
                            <Warning sx={{ fontSize: '16px', marginRight: '4px' }} />I couldn't find coordinates for
                            this study
                        </Link>
                    </Box>
                )}
            </Box>
            <EditStudyAnalysisCBMAPointSpaceAndStatistic analysisId={analysisId} />
            <EditStudyAnalysisCBMAPointsTableContainer
                analysisId={analysisId}
                snapshot={snapshot}
                onAllPointsHaveCoordinates={handleAllPointsHaveCoordinates}
            />
        </Box>
    );
};

export default EditStudyAnalysisCBMAPoints;
