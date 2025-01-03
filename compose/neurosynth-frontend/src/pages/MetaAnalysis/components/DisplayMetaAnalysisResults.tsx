import { Box, List, ListItemButton, ListItemText, Typography } from '@mui/material';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import NiiVueVisualizer from 'components/Visualizer/NiiVueVisualizer';
import { useGetMetaAnalysisResultById, useGetNeurovaultImages } from 'hooks';
import { INeurovault } from 'hooks/metaAnalyses/useGetNeurovaultImages';
import { MetaAnalysisReturn, NeurovaultFile, ResultReturn } from 'neurosynth-compose-typescript-sdk';
import { useEffect, useMemo, useState } from 'react';
import { NimareOutputs, parseNimareFileName } from '../Nimare.helpers';
import DisplayParsedNiMareFile from './DisplayParsedNiMareFile';
import MetaAnalysisResultStatusAlert from './MetaAnalysisResultStatusAlert';

const DisplayMetaAnalysisResults: React.FC<{
    metaAnalysis: MetaAnalysisReturn | undefined;
}> = (props) => {
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

    const sortedNeurovaultFiles = useMemo(() => {
        const orderMap = new Map(NimareOutputs.map((output, index) => [output.type, index]));
        // We want the order of the files to be very specific:
        // if algorithm is MKDAChi2, then set 1st image to be desc-associationMass
        //                                set 2nd image to be desc-uniformityMass
        // otherwise, sort all file names by value type as hardcoded in the NimareOutputs array
        //                                if multiple of the same value type, prioritize corr-cluster, then corr-voxel
        // note that generally, this is just alphabetical order

        const sorted = (neurovaultFiles || []).sort((a, b) => {
            const filenameA = parseNimareFileName(a.name);
            const filenameB = parseNimareFileName(b.name);

            const filenameWithMoreSegments = filenameA.length > filenameB.length ? filenameA : filenameB;
            for (let i = 0; i < filenameWithMoreSegments.length; i++) {
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
    }, [neurovaultFiles]);

    useEffect(() => {
        if (!sortedNeurovaultFiles) return;
        setSelectedNeurovaultImage(sortedNeurovaultFiles[0]);
    }, [sortedNeurovaultFiles]);

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
                            <NiiVueVisualizer
                                file={selectedNeurovaultImage.file}
                                filename={selectedNeurovaultImage.name || ''}
                                neurovaultLink={neurovaultLink}
                            />
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
