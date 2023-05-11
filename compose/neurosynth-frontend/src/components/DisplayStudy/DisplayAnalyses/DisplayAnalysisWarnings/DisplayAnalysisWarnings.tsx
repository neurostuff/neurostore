import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { Box, Chip } from '@mui/material';
import { IStorePoint, useStudyAnalysisPoints } from 'pages/Studies/StudyStore';

const DisplayAnalysisWarnings: React.FC<{ analysisId: string }> = (props) => {
    const points = useStudyAnalysisPoints(props.analysisId) as IStorePoint[] | null;

    const noPoints = (points?.length || 0) === 0;
    const coordinatesExistOutsideTheBrain = true;

    return (
        <Box sx={{ marginBottom: '1rem' }}>
            {noPoints && (
                <Chip
                    sx={{ margin: '2px' }}
                    icon={<ErrorOutlineIcon />}
                    label="This analysis has no coordinates"
                    color="warning"
                />
            )}
            {coordinatesExistOutsideTheBrain && (
                <Chip
                    sx={{ margin: '2px' }}
                    icon={<ErrorOutlineIcon />}
                    label="This analysis may contain coordinates that exist outside the brain"
                    color="warning"
                />
            )}
        </Box>
    );
};

export default DisplayAnalysisWarnings;
