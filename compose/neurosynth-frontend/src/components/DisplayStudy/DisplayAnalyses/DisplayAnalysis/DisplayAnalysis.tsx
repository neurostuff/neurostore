import { Typography, Box } from '@mui/material';
import { AnalysisReturn, ConditionReturn, PointReturn } from 'neurostore-typescript-sdk';

import DisplayPoints from './DisplayPoints/DisplayPoints';
import DisplayConditions from './DisplayConditions/DisplayConditions';

const DisplayAnalysis: React.FC<AnalysisReturn | undefined> = (props) => {
    return (
        <Box>
            <Box sx={{ marginBottom: '1rem' }}>
                <Typography gutterBottom sx={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>
                    Details
                </Typography>
                <Typography variant="h6">{props.name || ''}</Typography>
                <Typography>{props.description || ''}</Typography>
            </Box>

            <DisplayPoints points={(props.points || []) as PointReturn[]} />

            <DisplayConditions
                conditions={(props.conditions || []) as ConditionReturn[]}
                weights={props.weights || []}
            />
        </Box>
    );
};

export default DisplayAnalysis;
