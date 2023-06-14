import { Box, Link, Paper, Typography } from '@mui/material';
import { getResultStatus } from 'components/ProjectComponents/ViewMetaAnalyses/ViewMetaAnalysis';
import { MetaAnalysisReturn, ResultReturn } from 'neurosynth-compose-typescript-sdk';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import useGetAnalysisById from 'hooks/requests/useGetAnalysisById';
import DisplayPoints from 'components/DisplayStudy/DisplayAnalyses/DisplayAnalysis/DisplayPoints/DisplayPoints';
import { PointReturn } from 'neurostore-typescript-sdk';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';

const DisplayMetaAnalysisResult: React.FC<{
    metaAnalysis: MetaAnalysisReturn | undefined;
    metaAnalysisResult: ResultReturn | undefined;
}> = (props) => {
    const resultStatus = getResultStatus(props.metaAnalysis, props.metaAnalysisResult);

    const { data, isLoading, isError } = useGetAnalysisById(
        props.metaAnalysis?.neurostore_analysis?.neurostore_id || undefined
    );

    console.log({ data, isLoading, isError });

    return (
        <Paper sx={{ padding: '1rem', margin: '1rem 0' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="h5">Result</Typography>
                {resultStatus.color === 'error' && (
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <ErrorOutlineIcon color="error" sx={{ marginRight: '10px' }} />
                        <Typography sx={{ color: 'error.main' }}>
                            {resultStatus.statusText}
                        </Typography>
                    </Box>
                )}
            </Box>
            <Box sx={{ marginBottom: '1rem' }}>
                <Typography sx={{ fontWeight: 'bold' }} gutterBottom>
                    Neurovault
                </Typography>
                <Link
                    sx={{ fontWeight: 'normal' }}
                    underline="hover"
                    target="_blank"
                    href={props.metaAnalysisResult?.neurovault_collection?.url || ''}
                >
                    Neurovault Collection Link
                </Link>
            </Box>
            <StateHandlerComponent isLoading={isLoading} isError={isError}>
                <Box sx={{ height: '200px', overflow: 'hidden' }}>
                    <DisplayPoints
                        title="Peak Coordinates"
                        points={(data?.points as Array<PointReturn>) || []}
                    />
                </Box>
            </StateHandlerComponent>
        </Paper>
    );
};

export default DisplayMetaAnalysisResult;