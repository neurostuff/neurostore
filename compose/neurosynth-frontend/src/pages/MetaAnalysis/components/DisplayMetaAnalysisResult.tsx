import { Box, Link, Typography } from '@mui/material';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import NiiVueVisualizer from 'components/Visualizer/NiiVueVisualizer';
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

    const { points, analysisSpace, analysisMap } = studyPointsToStorePoints((data?.points || []) as PointReturn[]);

    const neurovaultLink = props.metaAnalysisResult?.neurovault_collection?.url || '';

    return (
        <Box>
            <Box display="flex">
                <Box width="300px">
                    <Box>item 1</Box>
                    <Box>item 2</Box>
                    <Box>item 3</Box>
                    <Box>item 3</Box>
                    <Box>item 3</Box>
                    <Box>item 3</Box>
                    <Box>item 3</Box>
                    <Box>item 3</Box>
                </Box>
                <Box sx={{ width: '100%' }}>
                    <NiiVueVisualizer imageURL="https://neurovault.org/media/images/18479/z_corr-FDR_method-indep.nii.gz" />
                </Box>
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
        </Box>
    );
};

export default DisplayMetaAnalysisResult;
