import { ContentCopy, Download } from '@mui/icons-material';
import { Box, Button, IconButton, Link, Paper, Tooltip, Typography } from '@mui/material';
import NeurosynthAccordion from 'components/NeurosynthAccordion/NeurosynthAccordion';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import { APA_CITATIONS_TEXT, NEUROSYNTH_COMPOSE_CITATION, NIMARE_CITATION } from 'hooks/useCitationCopy.consts';
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

    const handleCopyCitations = async () => {
        if (!navigator?.clipboard?.writeText) return;
        await navigator.clipboard.writeText(APA_CITATIONS_TEXT);
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
            <Paper
                elevation={0}
                sx={{
                    mt: 1.5,
                    p: 2,
                    pr: 5,
                    position: 'relative',
                    borderRadius: '8px',
                    border: '1px solid',
                    borderColor: 'grey.300',
                    backgroundColor: 'grey.50',
                }}
            >
                <Tooltip title="Copy citations">
                    <IconButton
                        aria-label="Copy APA citations"
                        onClick={handleCopyCitations}
                        size="small"
                        sx={{ position: 'absolute', top: 8, right: 8 }}
                    >
                        <ContentCopy fontSize="small" />
                    </IconButton>
                </Tooltip>
                <Typography variant="subtitle2" sx={{ mb: 0.6, fontWeight: 'bold' }}>
                    Citations (APA)
                </Typography>
                <Typography variant="body2" sx={{ mb: 0.75 }}>
                    {NEUROSYNTH_COMPOSE_CITATION.apaText}{' '}
                    <Link href={NEUROSYNTH_COMPOSE_CITATION.doiUrl} target="_blank" rel="noreferrer">
                        {NEUROSYNTH_COMPOSE_CITATION.doiUrl}
                    </Link>
                </Typography>
                <Typography variant="body2">
                    {NIMARE_CITATION.apaText}{' '}
                    <Link href={NIMARE_CITATION.doiUrl} target="_blank" rel="noreferrer">
                        {NIMARE_CITATION.doiUrl}
                    </Link>
                </Typography>
            </Paper>
        </Box>
    );
};

export default DisplayMetaAnalysisActivations;
