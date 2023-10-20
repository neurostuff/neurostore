import EditAnalysisPointsHotTable from 'components/HotTables/EditAnalysisPointsHotTable/EditAnalysisPointsHotTable';
import EditAnalysisPointSpaceAndStatistic from '../EditAnalysisPointSpaceAndStatistic/EditAnalysisPointSpaceAndStatistic';
import { Box, Tooltip, Typography } from '@mui/material';
import HelpIcon from '@mui/icons-material/Help';

const EditAnalysisPoints: React.FC<{ analysisId?: string }> = (props) => {
    return (
        <Box sx={{ marginTop: '2rem', width: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', margin: '0.5rem 0' }}>
                <Typography sx={{ fontWeight: 'bold', marginRight: '1rem' }}>
                    Analysis Coordinates
                </Typography>
                <Tooltip
                    title="To add or remove rows, right click on a cell to open the context menu. You must enter all coordinates in order to save the overall study. Please note that the ordering of points is not guaranteed."
                    placement="right"
                >
                    <HelpIcon color="primary" />
                </Tooltip>
            </Box>
            <EditAnalysisPointSpaceAndStatistic analysisId={props.analysisId} />
            <EditAnalysisPointsHotTable analysisId={props.analysisId} />
        </Box>
    );
};

export default EditAnalysisPoints;
