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
    useProjectExtractionStudysetId,
    useProjectNumCurationColumns,
    useUpdateStubField,
} from 'pages/Projects/ProjectPage/ProjectStore';
import { useEffect, useState } from 'react';
import {
    addStudyToStudyset,
    createStudyFromStub,
    getMatchingStudies,
    resolveStudysetAndCurationDifferences,
} from './helpers/utils';
import IngestionAwaitUserResponse from './IngestionAwaitUserResponse';

const Ingestion: React.FC<{
    onComplete: () => void;
}> = (props) => {
    const studysetId = useProjectExtractionStudysetId();
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
        currStudyset: string[];
        stubsToIngest: ICurationStubStudy[];
        numStudiesRemovedFromStudyset: number;
        ui: {
            stubBeingIngested: ICurationStubStudy;
            existingDuplicateStudies: StudyReturn[];
        } | null;
    }>({
        ingestionStatus: 'NOT-STARTED',
        ingestionIndex: 0,
        currStudyset: [],
        stubsToIngest: [], // not touched after initial set
        numStudiesRemovedFromStudyset: 0, // not touched after initial set
        ui: null,
    });

    // initial difference extractor
    useEffect(() => {
        if (!studyset?.studies || curationIncludedStudies.stubStudies.length === 0) return;
        const { removedFromStudyset, stubsToIngest, studiesInStudyset } =
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
                currStudyset: studiesInStudyset,
                numStudiesRemovedFromStudyset: removedFromStudyset.length,
            };
        });
    }, [studyset, curationIncludedStudies]);

    // this should only trigger the ingestion process after the initial differences are extracted,
    // or when the index is updated
    useEffect(() => {
        (async () => {
            if (
                !studysetId ||
                currentIngestionState.stubsToIngest.length === 0 ||
                currentIngestionState.ingestionStatus !== 'READY-TO-INGEST'
            ) {
                return;
            }

            setCurrentIngestionState((prev) => ({
                ...prev,
                ingestionStatus: 'INGESTION-IN-PROGRESS',
            }));

            const { currStudyset, ingestionIndex, stubsToIngest } = currentIngestionState;

            // we are done ingesting
            if (ingestionIndex >= stubsToIngest.length) {
                setCurrentIngestionState((prev) => ({
                    ...prev,
                    ingestionStatus: 'FINISHED',
                }));
                return;
            }

            try {
                const currStub = stubsToIngest[ingestionIndex];

                if (currStub.neurostoreId) {
                    // we either imported this stub from neurostore, or some weird thing happened where the stub was connnected
                    // to the study that was added to the studyset, but that study was later deleted or removed from the studyset.
                    // Either way, we add the associated neurostore id to the studyset.
                    const updatedStudyset = await addStudyToStudyset(
                        studysetId,
                        currStub.neurostoreId,
                        currStudyset
                    );
                    setCurrentIngestionState((prev) => ({
                        ...prev,
                        ingestionStatus: 'READY-TO-INGEST',
                        ingestionIndex: prev.ingestionIndex + 1,
                        currStudyset: updatedStudyset.studies as string[],
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
                    const updatedStudyset = await addStudyToStudyset(
                        studysetId,
                        newStudy.id as string,
                        currStudyset
                    );
                    setCurrentIngestionState((prev) => ({
                        ...prev,
                        ingestionStatus: 'READY-TO-INGEST',
                        currStudyset: updatedStudyset.studies as string[],
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
    }, [currentIngestionState, numColumns, studysetId, updateStubField]);

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

            const updatedStudyset = await addStudyToStudyset(
                studysetId,
                study.id as string,
                currentIngestionState.currStudyset
            );

            setCurrentIngestionState((prev) => ({
                ...prev,
                ingestionIndex: prev.ingestionIndex + 1,
                ingestionStatus: 'READY-TO-INGEST',
                currStudyset: updatedStudyset.studies as string[],
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
                        Ingesting studies ({currentIngestionState.ingestionIndex + 1} /{' '}
                        {currentIngestionState.stubsToIngest.length})
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
                    <Typography>
                        {currentIngestionState.stubsToIngest.length}{' '}
                        {currentIngestionState.stubsToIngest.length > 1 ? 'studies' : 'study'}{' '}
                        ingested into neurostore
                    </Typography>
                    {currentIngestionState.numStudiesRemovedFromStudyset > 0 && (
                        <Typography>
                            Removed {currentIngestionState.numStudiesRemovedFromStudyset} studies
                            from the studyset
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
