// 1. compare which studies need to be ingested. look at the included studies vs the studyset studies
// 2. once comparison is done, start ingestion process

import { Box } from '@mui/material';
import Typography from '@mui/material/Typography';
import LoadingButton from 'components/Buttons/LoadingButton/LoadingButton';
import { ICurationStubStudy } from 'components/CurationComponents/CurationStubStudy/CurationStubStudyDraggableContainer';
import ProgressLoader from 'components/ProgressLoader/ProgressLoader';
import { useGetStudysetById } from 'hooks';
import { StudyReturn } from 'neurostore-typescript-sdk';
import {
    useProjectCurationColumn,
    useProjectExtractionAnnotationId,
    useProjectExtractionStudysetId,
    useProjectNumCurationColumns,
    useUpdateStubField,
} from 'pages/Projects/ProjectPage/ProjectStore';
import { useEffect, useState } from 'react';
import {
    createStudyFromStub,
    getMatchingStudies,
    resolveStudysetAndCurationDifferences,
    setAnalysesInAnnotationAsIncluded,
    updateStudyset,
} from './helpers/utils';
import IngestionAwaitUserResponse from './IngestionAwaitUserResponse';

const Ingestion: React.FC<{
    onComplete: () => void;
}> = (props) => {
    const studysetId = useProjectExtractionStudysetId();
    const annotationId = useProjectExtractionAnnotationId();
    const numColumns = useProjectNumCurationColumns();
    const curationIncludedStudies = useProjectCurationColumn(numColumns - 1);
    const { data: studyset, refetch, isRefetching } = useGetStudysetById(studysetId, false);
    const updateStubField = useUpdateStubField();

    const [currentIngestionState, setCurrentIngestionState] = useState<{
        ingestionStatus:
            | 'NOT-STARTED' // nothing has occurred yet
            | 'INGESTION-IN-PROGRESS' // ingestion in progress
            | 'READY-TO-INGEST' // ready to accept the next stub to ingest
            | 'AWAITING-USER-RESPONSE' // we require user resolution to address existing studies
            | 'FINISHED' // ingestion is complete
            | 'ERROR'; // there was an error during ingestion
        ingestionIndex: number;
        currValidStudyset: string[];
        stubsToIngest: ICurationStubStudy[];
        studiesRemovedFromStudyset: string[];
        ui: {
            stubBeingIngested: ICurationStubStudy;
            existingDuplicateStudies: StudyReturn[];
        } | null;
    }>({
        ingestionStatus: 'NOT-STARTED',
        ingestionIndex: 0,
        currValidStudyset: [],
        stubsToIngest: [], // not touched after initial set
        studiesRemovedFromStudyset: [], // not touched after initial set
        ui: null,
    });

    // initial difference extractor
    useEffect(() => {
        if (!studyset?.studies || curationIncludedStudies.stubStudies.length === 0) return;
        const { removedFromStudyset, stubsToIngest, validStudiesInStudyset } =
            resolveStudysetAndCurationDifferences(
                curationIncludedStudies.stubStudies,
                (studyset.studies as StudyReturn[]).map((x) => x.id as string)
            );

        setCurrentIngestionState((prev) => {
            if (prev.ingestionStatus !== 'NOT-STARTED') return prev;

            return {
                ...prev,
                ingestionStatus: 'READY-TO-INGEST',
                stubsToIngest: stubsToIngest,
                currValidStudyset: validStudiesInStudyset,
                studiesRemovedFromStudyset: removedFromStudyset,
            };
        });
    }, [studyset, curationIncludedStudies]);

    // this should only trigger the ingestion process after the initial differences are extracted,
    // or when the index is updated.
    // We reconcile when the stubs to remove are greater than zero, or there are stubs to ingest
    useEffect(() => {
        (async () => {
            if (!studysetId || currentIngestionState.ingestionStatus !== 'READY-TO-INGEST') {
                return;
            }

            setCurrentIngestionState((prev) => ({
                ...prev,
                ingestionStatus: 'INGESTION-IN-PROGRESS',
            }));

            const { currValidStudyset, ingestionIndex, stubsToIngest, studiesRemovedFromStudyset } =
                currentIngestionState;

            try {
                const currStub = stubsToIngest[ingestionIndex];

                // we are done ingesting
                if (!currStub) {
                    if (stubsToIngest.length === 0 && studiesRemovedFromStudyset.length > 0) {
                        // remove studies from studyset if needed. If there are any stubs to be ingested, this removal will be done as part of that proces
                        await updateStudyset(studysetId, [...currValidStudyset]);
                    }
                    await setAnalysesInAnnotationAsIncluded(annotationId || '');

                    setCurrentIngestionState((prev) => ({
                        ...prev,
                        ingestionStatus: 'FINISHED',
                    }));
                    return;
                }

                if (currStub.neurostoreId) {
                    // we either imported this stub from neurostore, or some weird thing happened where the stub was connnected
                    // to the study that was added to the studyset, but that study was later deleted or removed from the studyset.
                    // Either way, we add the associated neurostore id to the studyset.
                    const updatedStudyset = await updateStudyset(studysetId, [
                        ...currValidStudyset,
                        currStub.neurostoreId,
                    ]);
                    setCurrentIngestionState((prev) => ({
                        ...prev,
                        ingestionStatus: 'READY-TO-INGEST',
                        ingestionIndex: prev.ingestionIndex + 1,
                        currValidStudyset: updatedStudyset.studies as string[],
                    }));
                    return;
                }

                const termToSearchFor = currStub.pmid || currStub.title || '';
                const matchingStudies = await getMatchingStudies(termToSearchFor);
                if (matchingStudies.length > 0) {
                    // there are 1 or more studies that are matching our stub existing in neurostore already.
                    // we need the user to pick which one they want to include
                    setCurrentIngestionState((prev) => ({
                        ...prev,
                        ingestionStatus: 'AWAITING-USER-RESPONSE',
                        ui: {
                            stubBeingIngested: currStub,
                            existingDuplicateStudies: matchingStudies,
                        },
                    }));
                } else {
                    // there are no neurostore matches - automatically add and move on
                    const newStudy = await createStudyFromStub(currStub);
                    updateStubField(
                        numColumns - 1,
                        currStub.id,
                        'neurostoreId',
                        newStudy.id as string
                    );
                    const updatedStudyset = await updateStudyset(studysetId, [
                        ...currValidStudyset,
                        newStudy.id as string,
                    ]);
                    setCurrentIngestionState((prev) => ({
                        ...prev,
                        ingestionStatus: 'READY-TO-INGEST',
                        currValidStudyset: updatedStudyset.studies as string[],
                        ingestionIndex: prev.ingestionIndex + 1,
                    }));
                }
            } catch (e) {
                console.error('there was an error');
                setCurrentIngestionState((prev) => ({
                    ...prev,
                    ingestionStatus: 'ERROR',
                }));
            }
        })();
    }, [annotationId, currentIngestionState, numColumns, studysetId, updateStubField]);

    const handleSelectStudy = async (
        option: StudyReturn | ICurationStubStudy,
        isStudy: boolean
    ) => {
        if (!studysetId) return;

        try {
            let study: StudyReturn;
            if (!isStudy) {
                study = await createStudyFromStub(option as ICurationStubStudy);
            } else {
                study = option as StudyReturn;
            }

            updateStubField(
                numColumns - 1,
                currentIngestionState.ui!.stubBeingIngested.id,
                'neurostoreId',
                study.id as string
            );

            const updatedStudyset = await updateStudyset(studysetId, [
                ...currentIngestionState.currValidStudyset,
                study.id as string,
            ]);

            setCurrentIngestionState((prev) => ({
                ...prev,
                ingestionIndex: prev.ingestionIndex + 1,
                ingestionStatus: 'READY-TO-INGEST',
                currValidStudyset: updatedStudyset.studies as string[],
                ui: null,
            }));
        } catch (e) {
            setCurrentIngestionState((prev) => ({
                ...prev,
                ingestionStatus: 'ERROR',
            }));
        }
    };

    const handleButtonClick = async () => {
        await refetch();
        props.onComplete();
    };

    switch (currentIngestionState.ingestionStatus) {
        case 'NOT-STARTED':
            return <Typography>Starting up ingestion...</Typography>;
        case 'INGESTION-IN-PROGRESS':
        case 'READY-TO-INGEST':
            const totalStubsToIngest = currentIngestionState.stubsToIngest.length;

            // theres a small delay and so it will show x + 1 / x. This logic prevents that
            const currIndex =
                currentIngestionState.ingestionIndex + 1 > totalStubsToIngest
                    ? totalStubsToIngest
                    : currentIngestionState.ingestionIndex + 1;

            return (
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        margin: '2rem 0',
                        flexDirection: 'column',
                    }}
                >
                    <Typography sx={{ marginBottom: '1rem' }} variant="h6">
                        Ingesting studies ({currIndex} / {totalStubsToIngest})
                    </Typography>
                    <ProgressLoader />
                </Box>
            );
        case 'AWAITING-USER-RESPONSE':
            return (
                <>
                    {currentIngestionState?.ui && (
                        <IngestionAwaitUserResponse
                            stubBeingIngested={currentIngestionState.ui.stubBeingIngested}
                            existingMatchingStudies={
                                currentIngestionState.ui.existingDuplicateStudies
                            }
                            onSelectOption={handleSelectStudy}
                            currentIngestionIndex={currentIngestionState.ingestionIndex}
                            totalToIngest={currentIngestionState.stubsToIngest.length}
                        />
                    )}
                </>
            );
        case 'FINISHED':
            return (
                <Box>
                    <Typography gutterBottom color="primary" variant="h6">
                        Ingestion process is complete
                    </Typography>
                    <Typography>Summary:</Typography>
                    {currentIngestionState.stubsToIngest.length > 0 && (
                        <Typography>
                            Ingested {currentIngestionState.stubsToIngest.length} into neurostore
                        </Typography>
                    )}
                    {currentIngestionState.studiesRemovedFromStudyset.length > 0 && (
                        <Typography>
                            Removed {currentIngestionState.studiesRemovedFromStudyset.length}{' '}
                            studies from the studyset
                        </Typography>
                    )}
                    <Box sx={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                        <LoadingButton
                            sx={{ width: '107px' }}
                            loaderColor="secondary"
                            isLoading={isRefetching}
                            text="complete"
                            variant="contained"
                            onClick={handleButtonClick}
                        />
                    </Box>
                </Box>
            );
        case 'ERROR':
        default:
            return (
                <Box>
                    <Typography color="error">There was an error ingesting studies</Typography>
                </Box>
            );
    }
};

export default Ingestion;
