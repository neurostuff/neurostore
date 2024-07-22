import { Box, Typography } from '@mui/material';
import StudyAnalysisWarnings from './StudyAnalysisWarnings';
import StudyPoints from './StudyPoints';
import { IStoreAnalysis } from 'pages/Study/store/StudyStore.helpers';

const StudyAnalysis: React.FC<IStoreAnalysis | undefined> = (props) => {
    return (
        <Box>
            <StudyAnalysisWarnings analysisId={props.id || ''} />
            <Box sx={{ marginBottom: '1rem' }}>
                <Typography gutterBottom sx={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>
                    Details
                </Typography>
                <Typography variant="h6">{props.name || ''}</Typography>
                <Typography>{props.description || ''}</Typography>
            </Box>

            <StudyPoints
                statistic={props.pointStatistic}
                space={props.pointSpace}
                title="Coordinates"
                points={props.points || []}
            />

            {/* <DisplayConditions
                conditions={(props.conditions || []) as ConditionReturn[]}
                weights={props.weights || []}
            /> */}
        </Box>
    );
};

export default StudyAnalysis;
