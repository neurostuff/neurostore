import { Box, Button, Link, List, ListItemButton, ListItemText, Typography } from '@mui/material';
import { OpenInNew } from '@mui/icons-material';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import NiiVueVisualizer from 'components/Visualizer/NiiVueVisualizer';
import { useGetMetaAnalysisResultById, useGetNeurovaultImages } from 'hooks';
import { INeurovault } from 'hooks/metaAnalyses/useGetNeurovaultImages';
import { MetaAnalysisReturn, NeurovaultFile, ResultReturn, Specification } from 'neurosynth-compose-typescript-sdk';
import { useEffect, useMemo, useState } from 'react';
import { NimareOutputs, parseNimareFileName } from '../Nimare.helpers';
import DisplayParsedNiMareFile from './DisplayParsedNiMareFile';
import MetaAnalysisResultStatusAlert from './MetaAnalysisResultStatusAlert';

const DisplayMetaAnalysisResults: React.FC<{
    metaAnalysis: MetaAnalysisReturn | undefined;
}> = ({ metaAnalysis }) => {
    // Each result represents a run. We just need to get the last item to get the latest run
    const metaAnalysisResults = (metaAnalysis?.results || []) as ResultReturn[];
    const { data, isLoading, isError } = useGetMetaAnalysisResultById(
        metaAnalysisResults[metaAnalysisResults.length - 1]?.id
    );
    const neurovaultCollectionLink = data?.neurovault_collection?.url || '';

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
        if (!neurovaultFiles || !metaAnalysis || !(metaAnalysis?.specification as Specification).estimator?.type)
            return [];

        // In the array, z is first. However, we want it to have more weight so we reverse the array and give it a higher index
        // Note: This array must be cloned as reverse() will mutate the array
        const orderMap = new Map([...NimareOutputs].reverse().map((output, index) => [output.key, index]));

        // We want the order of the files to be very specific:
        // if algorithm is MKDAChi2, then set 1st image to be z_desc-associationMass
        //                                set 2nd image to be z_desc-uniformityMass
        // otherwise, sort all file names by value type as hardcoded in the NimareOutputs array
        //                                if multiple of the same value type, prioritize level-cluster, then level-voxel
        // note that generally, this is just alphabetical order

        const sorted = (neurovaultFiles || []).sort((a, b) => {
            const filenameA = parseNimareFileName(a.name);
            const filenameB = parseNimareFileName(b.name);

            const filenameWithMoreSegments = filenameA.length > filenameB.length ? filenameA : filenameB;
            for (let i = 0; i < filenameWithMoreSegments.length; i++) {
                const segmentA = filenameA[i];
                const segmentB = filenameB[i];

                if (!segmentA && !segmentB) return 0;
                else if (!segmentA) return 1;
                else if (!segmentB) return -1;

                const orderA = orderMap.get(segmentA.key) ?? Infinity;
                const orderB = orderMap.get(segmentB.key) ?? Infinity;

                if (orderA === orderB) {
                    if (segmentA.value === segmentB.value) continue;
                    return segmentA.value.localeCompare(segmentB.value);
                } else {
                    return orderB - orderA;
                }
            }
            return 0;
        });

        // if MKDAChi2, move both z_desc-associationMass and z_desc-uniformityMass to the top respectively
        if ((metaAnalysis.specification as Specification).estimator?.type === 'MKDAChi2') {
            const uniformityMassIndex = sorted.findIndex((sortedElement) =>
                sortedElement.name?.includes('z_desc-uniformityMass')
            );
            if (uniformityMassIndex >= 0) {
                const [removedElement] = sorted.splice(uniformityMassIndex, 1);
                sorted.unshift(removedElement);
            }
            const associationMassIndex = sorted.findIndex((sortedElement) =>
                sortedElement.name?.includes('z_desc-associationMass')
            );
            if (associationMassIndex >= 0) {
                const [removedElement] = sorted.splice(associationMassIndex, 1);
                sorted.unshift(removedElement);
            }
        }

        return sorted;
    }, [neurovaultFiles, metaAnalysis]);

    useEffect(() => {
        if (!sortedNeurovaultFiles) return;
        setSelectedNeurovaultImage(sortedNeurovaultFiles[0]);
    }, [sortedNeurovaultFiles]);

    return (
        <StateHandlerComponent
            errorMessage={
                neurovaultCollectionLink ? (
                    <Button
                        component={Link}
                        sx={{ marginTop: '1rem' }}
                        href={
                            neurovaultCollectionLink.includes('/api')
                                ? neurovaultCollectionLink.replace(/\/api/, '')
                                : neurovaultCollectionLink
                        }
                        rel="noreferrer"
                        size="small"
                        variant="contained"
                        target="_blank"
                        disableElevation
                    >
                        Open in neurovault
                        <OpenInNew sx={{ marginLeft: '4px' }} fontSize="small" />
                    </Button>
                ) : (
                    'There was an error'
                )
            }
            isLoading={isLoading || neurovaultFilesIsLoading}
            isError={isError || neurovaultFilesIsError}
        >
            <MetaAnalysisResultStatusAlert metaAnalysis={metaAnalysis} metaAnalysisResult={data} />
            <Box display="flex" sx={{ height: '100%', minHeight: '600px' }}>
                <Box sx={{ width: '27%', maxHeight: '650px', overflowY: 'auto' }}>
                    <List sx={{ padding: 0 }}>
                        {(sortedNeurovaultFiles || []).map((neurovaultFile) => (
                            <ListItemButton
                                key={neurovaultFile.id}
                                onClick={() => setSelectedNeurovaultImage(neurovaultFile)}
                                selected={selectedNeurovaultImage?.id === neurovaultFile.id}
                            >
                                <ListItemText primary={neurovaultFile.name} />
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
                                neurovaultCollectionLink={neurovaultCollectionLink}
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
