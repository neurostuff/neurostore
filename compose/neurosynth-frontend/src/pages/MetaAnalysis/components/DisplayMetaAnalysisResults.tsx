import { OpenInNew } from '@mui/icons-material';
import { Box, Button, Link, List, ListItemButton, ListItemText, Typography } from '@mui/material';
import NiiVueVisualizer from 'components/Visualizer/NiiVueVisualizer';
import { MetaAnalysisReturn, NeurovaultFile, ResultReturn } from 'neurosynth-compose-typescript-sdk';
import MetaAnalysisResultStatusAlert from './MetaAnalysisResultStatusAlert';
import useGetMetaAnalysisResultById from 'hooks/metaAnalyses/useGetMetaAnalysisResultById';
import { useState } from 'react';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import useGetNeurovaultImages, { INeurovault } from 'hooks/metaAnalyses/useGetNeurovault';

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
    console.log({ neurovaultFiles });
    const [selectedNeurovaultImage, setSelectedNeurovaultImage] = useState<INeurovault>();

    return (
        <StateHandlerComponent
            isLoading={isLoading || neurovaultFilesIsLoading}
            isError={isError || neurovaultFilesIsError}
        >
            <MetaAnalysisResultStatusAlert metaAnalysis={props.metaAnalysis} metaAnalysisResult={data} />
            <Box display="flex" sx={{ height: '100%' }}>
                <Box sx={{ width: '27%', height: '100%', maxHeight: '448px', overflowY: 'auto' }}>
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
                        backgroundColor: '#f0f0f0',
                        padding: '1.5rem',
                        borderTopRightRadius: '0px',
                        borderBottomRightRadius: '8',
                        maxHeight: '448px',
                    }}
                >
                    {selectedNeurovaultImage?.file ? (
                        <NiiVueVisualizer imageURL={selectedNeurovaultImage.file} />
                    ) : (
                        <Typography color="warning.dark">No image selected</Typography>
                    )}
                </Box>
            </Box>
            <Button
                component={Link}
                sx={{ marginTop: '1rem', marginBottom: '2rem' }}
                href={neurovaultLink.includes('/api') ? neurovaultLink.replace(/\/api/, '') : neurovaultLink}
                variant="contained"
                rel="noreferrer"
                target="_blank"
                disableElevation
            >
                Open in neurovault
                <OpenInNew sx={{ marginLeft: 'px' }} />
            </Button>
        </StateHandlerComponent>
    );
};

export default DisplayMetaAnalysisResults;
