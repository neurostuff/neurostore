import { Box, Typography } from '@mui/material';
import EditAnalysisConditions from '../EditAnalysisConditions/EditAnalysisConditions';
import EditAnalysisDetails from '../EditAnalysisDetails/EditAnalysisDetails';
import EditAnalysisPoints from '../EditAnalysisPoints/EditAnalysisPoints';

const EditAnalysis: React.FC<{ analysisId?: string }> = (props) => {
    if (!props.analysisId) {
        return <Typography sx={{ color: 'warning.dark' }}>No analysis selected</Typography>;
    }

    return (
        <Box sx={{ marginBottom: '2rem' }}>
            <Box>
                <Typography sx={{ marginBottom: '1rem', fontWeight: 'bold' }}>
                    Analysis Details
                </Typography>
                <EditAnalysisDetails analysisId={props.analysisId} />
            </Box>

            <Box sx={{ marginTop: '2rem' }}>
                <Typography sx={{ marginBottom: '1rem', fontWeight: 'bold' }}>
                    Analysis Coordinates
                </Typography>
                <EditAnalysisPoints />
            </Box>
            <Box sx={{ marginTop: '2rem' }}>
                <Typography sx={{ marginBottom: '1rem', fontWeight: 'bold' }}>
                    Analysis Conditions
                </Typography>
                <EditAnalysisConditions analysisId={props.analysisId} />
            </Box>
        </Box>
    );
};

export default EditAnalysis;
