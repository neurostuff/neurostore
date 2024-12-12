import { Download, OpenInNew } from '@mui/icons-material';
import { Box, Button, Link, List, ListItemButton, ListItemText, Typography } from '@mui/material';
import NiiVueVisualizer from 'components/Visualizer/NiiVueVisualizer';
import { MetaAnalysisReturn, NeurovaultFile, ResultReturn } from 'neurosynth-compose-typescript-sdk';
import MetaAnalysisResultStatusAlert from './MetaAnalysisResultStatusAlert';
import useGetMetaAnalysisResultById from 'hooks/metaAnalyses/useGetMetaAnalysisResultById';
import { useEffect, useMemo, useState } from 'react';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import useGetNeurovaultImages, { INeurovault } from 'hooks/metaAnalyses/useGetNeurovault';
import DisplayParsedNiMareFile, { NimareOutputs, parseNimareFileName } from './DisplayParsedNiMareFile';
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

    const sortedNeurovaultFiles = useMemo(() => {
        const orderMap = new Map(NimareOutputs.map((output, index) => [output.type, index]));
        const sorted = neurovaultFiles?.sort((a, b) => {
            const filenameA = parseNimareFileName(a.name);
            const filenameB = parseNimareFileName(b.name);

            const longerFilename = filenameA.length > filenameB.length ? filenameA : filenameB;
            for (let i = 0; i < longerFilename.length; i++) {
                if (!filenameA[i]) return -1;
                if (!filenameB[i]) return 1;

                const orderA =
                    orderMap.get(filenameA[i].isValueType ? filenameA[i].value : filenameA[i].key) ?? Infinity;
                const orderB =
                    orderMap.get(filenameB[i].isValueType ? filenameB[i].value : filenameB[i].key) ?? Infinity;
                if (orderA === orderB) {
                    if (filenameA[i].value === filenameB[i].value) {
                        continue;
                    }
                    return filenameB[i].value.localeCompare(filenameA[i].value);
                } else {
                    return orderB - orderA;
                }
            }
            return 0;
        });
        return sorted?.reverse();
        // if (props.metaAnalysis?.specification) // check for meta analysis mkdachi2
    }, [neurovaultFiles]);

    return (
        <StateHandlerComponent
            isLoading={isLoading || neurovaultFilesIsLoading}
            isError={isError || neurovaultFilesIsError}
        >
            <MetaAnalysisResultStatusAlert metaAnalysis={props.metaAnalysis} metaAnalysisResult={data} />
            <Box display="flex" sx={{ height: '100%', minHeight: '600px' }}>
                <Box sx={{ width: '27%', maxHeight: '650px', overflowY: 'auto' }}>
                    <List sx={{ padding: 0 }}>
                        {(sortedNeurovaultFiles || []).map((neurovaultFile) => (
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
                    <Box sx={{ margin: '1rem 0' }}>
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
