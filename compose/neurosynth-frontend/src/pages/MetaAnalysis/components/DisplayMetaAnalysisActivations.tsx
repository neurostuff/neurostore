import { Download } from '@mui/icons-material';
import { Box, Button, Link, Paper, Typography } from '@mui/material';
import NeurosynthAccordion from 'components/NeurosynthAccordion/NeurosynthAccordion';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import { downloadFile, toCSV } from 'helpers/downloadFile.helpers';
import useGetAnalysisById from 'hooks/analyses/useGetAnalysisById';
import { PointReturn } from 'neurostore-typescript-sdk';
import { MetaAnalysisReturn, ResultReturn } from 'neurosynth-compose-typescript-sdk';
import StudyPoints from 'pages/Study/components/StudyPoints';
import { IStorePoint, studyPointsToStorePoints } from 'pages/Study/store/StudyStore.helpers';

const pointToCSVRow = (point: IStorePoint) => {
    return {
        x: point.coordinates?.[0],
        y: point.coordinates?.[1],
        z: point.coordinates?.[2],
        value: point.value,
        cluster_size: point.cluster_size,
        subpeak: point.subpeak,
    };
};

const DisplayMetaAnalysisActivations: React.FC<{
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

    const handleDownloadCSV = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();

        const csvPoints = points.map(pointToCSVRow);
        const csv = toCSV(['x', 'y', 'z', 'value', 'cluster_size', 'subpeak'], csvPoints);
        downloadFile(props.metaAnalysis?.name ?? '', csv, 'text/csv;charset=utf-8');
    };

    const heightInPx = points.length * 50 > 500 ? 500 : points.length * 50;

    return (
        <Box sx={{ margin: '2rem 0' }}>
            <NeurosynthAccordion
                elevation={2}
                defaultExpanded
                expandIconColor="primary.main"
                TitleElement={
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                        <Typography variant="h6">Peak Activation Coordinates</Typography>
                        <Button
                            disableElevation
                            endIcon={<Download />}
                            onClick={handleDownloadCSV}
                            size="small"
                            variant="contained"
                            color="primary"
                            sx={{ mr: 2 }}
                        >
                            Download as CSV
                        </Button>
                    </Box>
                }
                sx={{ padding: '0.2rem' }}
            >
                <StateHandlerComponent isLoading={isLoading} isError={isError}>
                    <StudyPoints
                        statistic={analysisMap}
                        space={analysisSpace}
                        height={`${heightInPx}px`}
                        points={points}
                    />
                </StateHandlerComponent>
            </NeurosynthAccordion>
        </Box>
    );
};

export default DisplayMetaAnalysisActivations;
