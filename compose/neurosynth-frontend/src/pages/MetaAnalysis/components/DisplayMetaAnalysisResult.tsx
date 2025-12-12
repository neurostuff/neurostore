import { Box, Link, Paper, Typography } from '@mui/material';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import useGetAnalysisById from 'hooks/analyses/useGetAnalysisById';
import { PointReturn } from 'neurostore-typescript-sdk';
import { MetaAnalysisReturn, ResultReturn } from 'neurosynth-compose-typescript-sdk';
import StudyPoints from 'pages/Study/components/StudyPoints';
import { studyPointsToStorePoints } from 'pages/Study/store/StudyStore.helpers';

const DisplayMetaAnalysisResult: React.FC<{
    metaAnalysis: MetaAnalysisReturn | undefined;
    metaAnalysisResult: ResultReturn | undefined;
}> = (props) => {
    const { data, isLoading, isError } = useGetAnalysisById(
        props.metaAnalysis?.neurostore_analysis?.neurostore_id || undefined
    );

    const { points, analysisSpace, analysisMap } = studyPointsToStorePoints(
        (data?.points || []) as PointReturn[],
        false
    );

    const neurovaultLink = props.metaAnalysisResult?.neurovault_collection?.url || '';

    return (
        <Paper sx={{ padding: '1rem', margin: '1rem 0' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography sx={{ marginBottom: '1rem' }} variant="h5">
                    Result
                </Typography>
            </Box>
            <Box sx={{ marginBottom: '1rem' }}>
                <Typography sx={{ fontWeight: 'bold' }} gutterBottom>
                    Neurovault
                </Typography>
                <Link
                    sx={{ fontWeight: 'normal' }}
                    underline="hover"
                    target="_blank"
                    rel="noreferrer"
                    href={neurovaultLink.includes('/api') ? neurovaultLink.replace(/\/api/, '') : neurovaultLink}
                >
                    Neurovault Collection Link
                </Link>
            </Box>
            <StateHandlerComponent isLoading={isLoading} isError={isError}>
                <StudyPoints
                    statistic={analysisMap}
                    space={analysisSpace}
                    height="200px"
                    title="Peak Coordinates"
                    points={points}
                />
            </StateHandlerComponent>
        </Paper>
    );
};

export default DisplayMetaAnalysisResult;
