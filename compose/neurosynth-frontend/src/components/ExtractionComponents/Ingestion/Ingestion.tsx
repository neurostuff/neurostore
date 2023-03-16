// 1. compare which studies need to be ingested. look at the included studies vs the studyset studies
// 2. once comparison is done, start ingestion process

import { Box } from '@mui/material';
import Typography from '@mui/material/Typography';
import { ICurationStubStudy } from 'components/CurationComponents/CurationStubStudy/CurationStubStudyDraggableContainer';
import ProgressLoader from 'components/ProgressLoader/ProgressLoader';
import { useGetStudysetById } from 'hooks';
import { StudyReturn } from 'neurostore-typescript-sdk';
import {
    useProjectCurationColumn,
    useProjectExtractionStudysetId,
    useProjectNumCurationColumns,
} from 'pages/Projects/ProjectPage/ProjectStore';
import { useEffect, useState } from 'react';
import API from 'utils/api';
import IngestionAwaitUserResponse from './IngestionAwaitUserResponse';

const getMatchingStudies = async (searchTerm: string): Promise<StudyReturn[]> => {
    try {
        const study = await API.NeurostoreServices.StudiesService.studiesGet(
            searchTerm,
            undefined,
            undefined,
            undefined,
            undefined,
            false,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined
        );

        const databaseHasStubAlready = study.data.results || [];
        return databaseHasStubAlready;
    } catch (e) {
        throw new Error('error getting study');
    }
};

const resolveStudysetAndCurationDifferences = (
    curationStubs: ICurationStubStudy[],
    studysetStudies: StudyReturn[]
) => {
    const returnObj: {
        removedFromStudyset: StudyReturn[];
        stubsToIngest: ICurationStubStudy[];
        studiesInStudyset: StudyReturn[];
    } = {
        removedFromStudyset: [],
        stubsToIngest: [],
        studiesInStudyset: [],
    };

    const studysetMap = new Map<string, StudyReturn>();
    studysetStudies.forEach((study) => studysetMap.set(study.id as string, study));

    curationStubs.forEach((stub) => {
        if (stub.neurostoreId) {
            if (studysetMap.has(stub.neurostoreId)) {
                const study = studysetMap.get(stub.neurostoreId) as StudyReturn;
                returnObj.studiesInStudyset.push(study);
                studysetMap.delete(stub.neurostoreId);
            } else {
                returnObj.stubsToIngest.push(stub);
            }
        } else {
            returnObj.stubsToIngest.push(stub);
        }
    });

    for (const entry in studysetMap) {
        returnObj.removedFromStudyset.push(studysetMap.get(entry) as StudyReturn);
    }

    return returnObj;
};

const Ingestion: React.FC = (props) => {
    const studysetId = useProjectExtractionStudysetId();
    const numColumns = useProjectNumCurationColumns();
    const curationIncludedStudies = useProjectCurationColumn(numColumns - 1);
    const { data: studyset } = useGetStudysetById(studysetId);

    const [currentIngestionState, setCurrentIngestionState] = useState<{
        ingestionStatus:
            | 'NOT-STARTED'
            | 'IN-PROGRESS'
            | 'AWAITING-USER-RESPONSE'
            | 'FINISHED'
            | 'ERROR';
        ingestionIndex: number;
        currStudyset: StudyReturn[];
        stubsToIngest: ICurationStubStudy[];
        numStudiesRemovedFromStudyset: number;
        ui: {
            stubBeingIngest: ICurationStubStudy;
            existingDuplicateStudies: StudyReturn[];
        } | null;
    }>({
        ingestionStatus: 'NOT-STARTED',
        ingestionIndex: 0,
        currStudyset: [],
        stubsToIngest: [],
        numStudiesRemovedFromStudyset: 0,
        ui: null,
    });

    const createStudyFromStub = async (stub: ICurationStubStudy) => {
        try {
            // 1. create study using the stub
            const createdStudy = await API.NeurostoreServices.StudiesService.studiesPost(
                undefined,
                undefined,
                {
                    name: stub.title,
                    doi: stub.doi,
                    description: stub.abstractText,
                    publication: stub.journal,
                    pmid: stub.pmid,
                    authors: stub.authors,
                    year: parseInt(stub.articleYear || '0'),
                }
            );

            await addStudyToStudyset(createdStudy.data);
        } catch (e) {
            throw new Error('error creating study from stub');
        }
    };

    const addStudyToStudyset = async (stub: StudyReturn) => {
        // add study to studyset and handle update currStudyset
        // try {
        // 2. add the stub to the studyset
        //     const updatedStudyset = await mutateAsync({
        //         studysetId: project?.provenance?.extractionMetadata?.studysetId || '',
        //         studyset: {
        //             studies: [...ingestionProgressRef.current.studyList, study.id as string],
        //         },
        //     });
        //     // 3. increment currentStubIndex to next
        //     ingestionProgressRef.current.studyList = updatedStudyset.data.studies as string[];
        //     ingestionProgressRef.current.currentStubIndex++;
        //     // 4. start the ingestion process for the next stub
        //     await startIngestionProcess();
        // } catch (e) {
        //     throw new Error('error adding study to studyset');
        // }
    };

    const handleSelectStudy = () => {};

    // initial difference extractor
    useEffect(() => {
        if (!studyset?.studies) return;
        const { removedFromStudyset, stubsToIngest, studiesInStudyset } =
            resolveStudysetAndCurationDifferences(
                curationIncludedStudies.stubStudies,
                studyset.studies as StudyReturn[]
            );

        setCurrentIngestionState((prev) => {
            if (prev.ingestionStatus !== 'NOT-STARTED') return prev;

            return {
                ...prev,
                stubsToIngest: stubsToIngest,
                currStudyset: studiesInStudyset,
                numStudiesRemovedFromStudyset: removedFromStudyset.length,
            };
        });
    }, [studyset, curationIncludedStudies]);

    useEffect(() => {
        (async () => {
            if (currentIngestionState.stubsToIngest.length === 0) return;
            if (currentIngestionState.isIngesting) return;

            const termToSearchFor =
                currentIngestionState?.stubsToIngest[currentIngestionState.ingestionIndex].pmid ||
                '';
            const studies = await getMatchingStudies(termToSearchFor);
            if (studies.length > 0) {
                setCurrentIngestionState((prev) => ({
                    ...prev,
                    isIngesting: true,
                }));
                setView();
            } else {
                const newStudy = await createStudyFromStub();
                const res = await addStudyToStudyset(newStudy);
                setCurrentIngestionState((prev) => ({
                    ...prev,
                    ingestionIndex: prev.ingestionIndex + 1,
                    isIngesting: false,
                }));
            }
        })();
    }, [currentIngestionState, diffState]);

    switch (currentIngestionState.ingestionStatus) {
        case 'NOT-STARTED':
            return <Typography>Starting up ingestion...</Typography>;
        case 'IN-PROGRESS':
            return <ProgressLoader />;
        case 'AWAITING-USER-RESPONSE':
            return (
                <>
                    {currentIngestionState?.ui && (
                        <IngestionAwaitUserResponse
                            stubBeingIngested={currentIngestionState.ui.stubBeingIngest}
                            existingMatchingStudies={
                                currentIngestionState.ui.existingDuplicateStudies
                            }
                            onSelectOption={() => {}}
                            currentIngestionIndex={currentIngestionState.ingestionIndex}
                            totalToIngest={currentIngestionState.stubsToIngest.length}
                        />
                    )}
                </>
            );
        case 'FINISHED':
            return (
                <Box>
                    <Typography>Ingestion process is complete</Typography>
                    <Typography>Ingestion Summary:</Typography>
                    <Typography>
                        {currentIngestionState.stubsToIngest.length} studies ingested into
                        neurostore
                    </Typography>
                    {currentIngestionState.numStudiesRemovedFromStudyset > 0 && (
                        <Typography>
                            Removed {currentIngestionState.numStudiesRemovedFromStudyset} studies
                            from the studyset
                        </Typography>
                    )}
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
    // if (currentIngestionState.ingestionStatus === 'NOT-STARTED') {
    //     return <Typography>Starting up ingestion...</Typography>
    // } else if ) {

    // } else if (currentIngestionState.) {

    // }

    // if (currentIngestionState.ingestionHasStarted) {

    // }
};

export default Ingestion;
