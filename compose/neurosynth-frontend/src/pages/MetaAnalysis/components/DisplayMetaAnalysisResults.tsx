import { Download, OpenInNew } from '@mui/icons-material';
import { Box, Button, Link, List, ListItemButton, ListItemText, Typography } from '@mui/material';
import NiiVueVisualizer from 'components/Visualizer/NiiVueVisualizer';
import { MetaAnalysisReturn, NeurovaultFile, ResultReturn } from 'neurosynth-compose-typescript-sdk';
import MetaAnalysisResultStatusAlert from './MetaAnalysisResultStatusAlert';
import useGetMetaAnalysisResultById from 'hooks/metaAnalyses/useGetMetaAnalysisResultById';
import { useEffect, useState } from 'react';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import useGetNeurovaultImages, { INeurovault } from 'hooks/metaAnalyses/useGetNeurovault';
import DisplayParsedNiMareFile from './DisplayParsedNiMareFile';
import ImageIcon from '@mui/icons-material/Image';

const DisplayMetaAnalysisResults: React.FC<{
    metaAnalysis: MetaAnalysisReturn | undefined;
}> = (props) => {
    // const [] = useState();

    // Each result represents a run. We just need to get the last item to get the latest run
    const metaAnalysisResults = (props.metaAnalysis?.results || []) as ResultReturn[];
    const { data, isLoading, isError } = useGetMetaAnalysisResultById(
        metaAnalysisResults[metaAnalysisResults.length - 1]?.id
    );
    const neurovaultLink = data?.neurovault_collection?.url || '';

    const neurovaultFileURLs = ((data?.neurovault_collection?.files || []) as NeurovaultFile[]).map(
        (file) => file.url || ''
    );
    const {
        data: neurovaultFiles,
        isLoading: neurovaultFilesIsLoading,
        isError: neurovaultFilesIsError,
    } = useGetNeurovaultImages(neurovaultFileURLs);
    const [selectedNeurovaultImage, setSelectedNeurovaultImage] = useState<INeurovault>();

    useEffect(() => {
        if (!neurovaultFiles) return;
        setSelectedNeurovaultImage(neurovaultFiles[0]);
    }, [neurovaultFiles]);

    return (
        <StateHandlerComponent
            isLoading={isLoading || neurovaultFilesIsLoading}
            isError={isError || neurovaultFilesIsError}
        >
            <MetaAnalysisResultStatusAlert metaAnalysis={props.metaAnalysis} metaAnalysisResult={data} />
            <Box display="flex" sx={{ height: '100%', minHeight: '600px' }}>
                <Box sx={{ width: '27%', maxHeight: '600px', overflowY: 'auto' }}>
                    <List sx={{ padding: 0 }}>
                        {(neurovaultFiles || []).map((neurovaultFile) => (
                            <ListItemButton
                                key={neurovaultFile.id}
                                onClick={() => setSelectedNeurovaultImage(neurovaultFile)}
                                selected={selectedNeurovaultImage?.id === neurovaultFile.id}
                            >
                                <ListItemText primary={neurovaultFile.name} secondary={neurovaultFile.map_type} />
                            </ListItemButton>
                        ))}
                    </List>
                </Box>
                <Box
                    sx={{
                        width: '73%',
                        // backgroundColor: '#0000000a',
                        padding: '1.5rem',
                        paddingTop: 0,
                        borderTopRightRadius: '0px',
                        borderBottomRightRadius: '8',
                    }}
                >
                    <Box sx={{ marginBottom: '1rem' }}>
                        <DisplayParsedNiMareFile nimareFileName={selectedNeurovaultImage?.name} />
                    </Box>
                    {selectedNeurovaultImage?.file ? (
                        <>
                            <NiiVueVisualizer imageURL={selectedNeurovaultImage.file} />
                            <Box display="flex" alignItems="center" justifyContent="space-between">
                                <Button
                                    component={Link}
                                    sx={{ marginTop: '0.5rem' }}
                                    href={
                                        neurovaultLink.includes('/api')
                                            ? neurovaultLink.replace(/\/api/, '')
                                            : neurovaultLink
                                    }
                                    variant="contained"
                                    rel="noreferrer"
                                    size="small"
                                    target="_blank"
                                    disableElevation
                                >
                                    Open in neurovault
                                    <OpenInNew sx={{ marginLeft: '4px' }} fontSize="small" />
                                </Button>
                                <Box>
                                    <Button
                                        size="small"
                                        variant="contained"
                                        endIcon={<Download />}
                                        sx={{ marginTop: '0.5rem', marginRight: '0.5rem' }}
                                    >
                                        Download nifti
                                    </Button>
                                    <Button
                                        size="small"
                                        variant="contained"
                                        endIcon={<ImageIcon />}
                                        sx={{ marginTop: '0.5rem' }}
                                    >
                                        Download image
                                    </Button>
                                </Box>
                            </Box>
                        </>
                    ) : (
                        <Typography color="warning.dark">No image selected</Typography>
                    )}
                </Box>
            </Box>
        </StateHandlerComponent>
    );
};

export default DisplayMetaAnalysisResults;
