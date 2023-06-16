import { Box, Typography } from '@mui/material';

import DisplayAnalysisWarnings from '../DisplayAnalysisWarnings/DisplayAnalysisWarnings';
import DisplayPoints from './DisplayPoints/DisplayPoints';
import { IStoreAnalysis } from 'pages/Studies/StudyStore.helpers';

const DisplayAnalysis: React.FC<IStoreAnalysis | undefined> = (props) => {
    return (
        <Box>
            <DisplayAnalysisWarnings analysisId={props.id || ''} />
            <Box sx={{ marginBottom: '1rem' }}>
                <Typography gutterBottom sx={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>
                    Details
                </Typography>
                <Typography variant="h6">{props.name || ''}</Typography>
                <Typography>{props.description || ''}</Typography>
            </Box>

            <DisplayPoints
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

export default DisplayAnalysis;
