import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { Box, Chip } from '@mui/material';
import { useStudyAnalysisPoints } from 'pages/Studies/StudyStore';
import { IStorePoint } from 'pages/Studies/StudyStore.helpers';

export const isCoordinateMNI = (x: number, y: number, z: number) => {
    const dims = {
        xMax: 90,
        xMin: -90,
        yMax: 90,
        yMin: -126,
        zMax: 108,
        zMin: -72,
    };

    return (
        x <= dims.xMax &&
        x >= dims.xMin &&
        y <= dims.yMax &&
        y >= dims.yMin &&
        z <= dims.zMax &&
        z >= dims.zMin
    );
};

const DisplayAnalysisWarnings: React.FC<{ analysisId: string }> = (props) => {
    const points = useStudyAnalysisPoints(props.analysisId) as IStorePoint[] | null;

    const noPoints = (points?.length || 0) === 0;
    const allCoordinatesAreMNI = (points || []).every((x) => {
        return isCoordinateMNI(x.x || 0, x.y || 0, x.z || 0);
    });

    return (
        <Box>
            {noPoints && (
                <Chip
                    sx={{ margin: '2px', marginBottom: '1rem' }}
                    icon={<ErrorOutlineIcon />}
                    label="This analysis has no coordinates"
                    color="warning"
                />
            )}
            {!allCoordinatesAreMNI && (
                <Chip
                    sx={{ margin: '2px', marginBottom: '1rem' }}
                    icon={<ErrorOutlineIcon />}
                    label="This analysis may contain non MNI coordinates"
                    color="warning"
                />
            )}
        </Box>
    );
};

export default DisplayAnalysisWarnings;
