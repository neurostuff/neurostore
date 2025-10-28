import EditStudyAnalysisPointsHotTable from 'pages/Study/components/EditStudyAnalysisPointsHotTable';
import { Box, Tooltip, Typography } from '@mui/material';
import HelpIcon from '@mui/icons-material/Help';
import EditStudyAnalysisPointSpaceAndStatistic from 'pages/Study/components/EditStudyAnalysisPointSpaceAndStatistic';

const EditStudyAnalysisPoints: React.FC<{ analysisId?: string }> = (props) => {
    return (
        <Box sx={{ marginTop: '2rem' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', margin: '0.5rem 0' }}>
                <Typography sx={{ fontWeight: 'bold', marginRight: '1rem' }}>Analysis Coordinates</Typography>
                <Tooltip
                    title="To add or remove rows, right click on a cell to open the context menu. You must enter all coordinates in order to save the overall study. Please note that the ordering of points is not guaranteed."
                    placement="right"
                >
                    <HelpIcon color="primary" />
                </Tooltip>
            </Box>
            <EditStudyAnalysisPointSpaceAndStatistic analysisId={props.analysisId} />
            <EditStudyAnalysisPointsHotTable analysisId={props.analysisId} />
        </Box>
    );
};

export default EditStudyAnalysisPoints;
