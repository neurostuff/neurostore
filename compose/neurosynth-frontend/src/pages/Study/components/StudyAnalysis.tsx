import { Box, Typography } from '@mui/material';
import StudyAnalysisWarnings from 'pages/Study/components/StudyAnalysisWarnings';
import StudyPoints from 'pages/Study/components/StudyPoints';
import { IStoreAnalysis } from 'stores/study/StudyStore.helpers';

const StudyAnalysis = (props: IStoreAnalysis) => {
    const heightInPx = props.points?.length ? (props.points.length * 50 > 500 ? 500 : props.points.length * 50) : 0;

    return (
        <Box>
            <StudyAnalysisWarnings analysisId={props.id || ''} />
            <Box sx={{ marginBottom: '1rem' }}>
                <Typography gutterBottom sx={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>
                    Details
                </Typography>
                <Typography variant="h6">{props.name || ''}</Typography>
                <Typography variant="body2" color="muted.main">
                    {props.description || ''}
                </Typography>
            </Box>

            <StudyPoints
                statistic={props.pointStatistic}
                space={props.pointSpace}
                title="Coordinates"
                points={props.points || []}
                height={`${heightInPx}px`}
            />

            {/* <DisplayConditions
                conditions={(props.conditions || []) as ConditionReturn[]}
                weights={props.weights || []}
            /> */}
        </Box>
    );
};

export default StudyAnalysis;
