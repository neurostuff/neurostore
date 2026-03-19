import EditStudyAnalysisCBMAPointsHotTable from 'pages/Study/components/EditStudyAnalysisCBMAPointsHotTable';
import { Box, Link, Tooltip, Typography } from '@mui/material';
import HelpIcon from '@mui/icons-material/Help';
import EditStudyAnalysisCBMAPointSpaceAndStatistic from 'pages/Study/components/EditStudyAnalysisCBMAPointSpaceAndStatistic';
import RelegateExtractionStudyDialog from './RelegateExtractionStudyDialog';
import { clearExtractionTableState } from 'pages/Extraction/components/ExtractionTable.helpers';
import { useNavigate } from 'react-router-dom';
import { useProjectId } from 'pages/Project/store/ProjectStore';
import { useState } from 'react';
import { useSnackbar } from 'notistack';
import { Warning } from '@mui/icons-material';

const EditStudyAnalysisCBMAPoints: React.FC<{ analysisId?: string }> = (props) => {
    const navigate = useNavigate();
    const projectId = useProjectId();
    const { enqueueSnackbar } = useSnackbar();
    const [relegateExtractionStudyDialogState, setRelegateExtractionStudyDialogState] = useState(false);

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
                        <HelpIcon color="primary" />
                    </Tooltip>
                </Box>
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
                        <Warning sx={{ fontSize: '16px', marginRight: '4px' }} />I couldn't find coordinates for this
                        study
                    </Link>
                </Box>
            </Box>
            <EditStudyAnalysisCBMAPointSpaceAndStatistic analysisId={props.analysisId} />
            <EditStudyAnalysisCBMAPointsHotTable analysisId={props.analysisId} />
        </Box>
    );
};

export default EditStudyAnalysisCBMAPoints;
