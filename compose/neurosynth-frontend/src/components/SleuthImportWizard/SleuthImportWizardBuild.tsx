import { useAuth0 } from '@auth0/auth0-react';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import { Box, Button, CircularProgress, LinearProgress, Typography } from '@mui/material';
import CurationImportBaseStyles from 'components/CurationComponents/CurationImport/CurationImportBase.styles';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import {
    useCreateAnnotation,
    useCreateProject,
    useCreateStudy,
    useCreateStudyset,
    useUpdateStudy,
} from 'hooks';
import useGetPubMedIdFromDOI from 'hooks/external/useGetPubMedIdFromDOI';
import useGetPubmedIDs from 'hooks/external/useGetPubMedIds';
import useIngest from 'hooks/studies/useIngest';
import { useEffect, useRef, useState } from 'react';
import {
    ISleuthFileUploadStubs,
    applyPubmedStudyDetailsToBaseStudies,
    generateAnnotationForSleuthImport,
    createProjectHelper,
    ingestBaseStudies,
    lookForPMIDsAndFetchStudyDetails,
    sleuthStubsToBaseStudies,
    updateUploadSummary,
} from './SleuthImportWizard.utils';
import { EPropertyType } from 'components/EditMetadata';
import { NoteCollectionReturn, StudyReturn } from 'neurostore-typescript-sdk';

const SleuthImportWizardBuild: React.FC<{
    sleuthUploads: ISleuthFileUploadStubs[];
    onNext: (projectId: string, studysetId: string, annotationId: string) => void;
}> = (props) => {
    const { user } = useAuth0();
    const { queryImperatively } = useGetPubmedIDs([], false);
    const { mutateAsync: getPubMedIdFromDOI } = useGetPubMedIdFromDOI();
    const [progressValue, setProgressValue] = useState(0);
    const [progressText, setProgressText] = useState('');
    const { mutateAsync: ingestAsync } = useIngest();
    const { mutateAsync: createStudyVersion } = useCreateStudy();
    const { mutateAsync: updateStudy } = useUpdateStudy();
    const { mutateAsync: createStudyset } = useCreateStudyset();
    const { mutateAsync: createAnnotation } = useCreateAnnotation();
    const { mutateAsync: createProject } = useCreateProject();
    const loadingState = useRef<{
        started: boolean;
    }>({
        started: false,
    });
    const { sleuthUploads, onNext } = props;
    const [createdProjectComponents, setCreatedProjectComponents] = useState({
        projectId: '',
        studysetId: '',
        annotationId: '',
    });
    const [isLoadingState, setIsLoadingState] = useState(true);
    const [isError, setIsError] = useState(false);

    useEffect(() => {
        if (sleuthUploads.length === 0) return;
        if (loadingState.current.started) return;

        loadingState.current.started = true;
        setIsLoadingState(true);

        const build = async (sleuthUploads: ISleuthFileUploadStubs[]) => {
            if (!user?.sub) return;

            try {
                setProgressValue(0);
                setProgressText('Starting upload...');

                const studyIdsSet = new Set<string>();
                const annotationNotes: NoteCollectionReturn[] = [];
                let annotationNoteKeys: { [key: string]: EPropertyType } = {
                    included: EPropertyType.BOOLEAN,
                };
                const uploads: { fileName: string; studies: StudyReturn[] }[] = [];

                let index = 0;
                const percentageIncrement = 80 / sleuthUploads.length;
                for (const sleuthUpload of sleuthUploads) {
                    let percentageAlreadyComplete = index * percentageIncrement;
                    // 1. convert sleuth stubs to a format neurosynth compose recognizes
                    const baseStudies = sleuthStubsToBaseStudies(sleuthUpload.sleuthStubs);

                    // 2. query pubmed for PMIDs based on the DOIs supplied. Fetch studies by PMIDs
                    const pubmedStudies = await lookForPMIDsAndFetchStudyDetails(
                        baseStudies,
                        getPubMedIdFromDOI,
                        (progress) => {
                            setProgressValue(
                                Math.round(
                                    (progress / 100) * (percentageIncrement / 2) +
                                        percentageAlreadyComplete
                                )
                            );
                        },
                        queryImperatively
                    );

                    // 3. From the previous step, take our initial undetailed base studies and add details from pubmed
                    // This func will also remove duplicates as we only need the baseStudiesWithPubmedDetails to use as an ingestion reference
                    const baseStudiesWithPubmedDetailsNoDuplicates =
                        applyPubmedStudyDetailsToBaseStudies(baseStudies, pubmedStudies);
                    // 4. ingest the base studies and consolidate the sleuth stubs into Studies.
                    // If N sleuth stubs have the same DOI, then a study object is created, with N analyses representing each sleuth stub
                    const studyResponses = await ingestBaseStudies(
                        baseStudiesWithPubmedDetailsNoDuplicates,
                        sleuthUpload,
                        user.sub as string,
                        ingestAsync,
                        (progress) => {
                            setProgressValue(
                                Math.round(
                                    (progress / 100) * (percentageIncrement / 2) +
                                        (percentageAlreadyComplete + percentageIncrement / 2)
                                )
                            );
                        }
                    );
                    studyResponses.forEach((x) => studyIdsSet.add(x.id as string));

                    const { noteKeys, notes } = generateAnnotationForSleuthImport(
                        studyResponses,
                        sleuthUpload.fileName
                    );
                    annotationNoteKeys = { ...annotationNoteKeys, ...noteKeys };
                    annotationNotes.push(...notes);

                    uploads.push({
                        fileName: sleuthUpload.fileName,
                        studies: studyResponses,
                    });
                    index++;
                }

                setProgressValue(85);
                setProgressText('Creating studyset...');

                const createdStudyset = await createStudyset({
                    name: `Studyset for Untitled sleuth project`,
                    description: '',
                    studies: Array.from(studyIdsSet),
                });
                if (!createdStudyset.data.id) throw new Error('Created studyset but found no ID');

                setProgressValue(90);
                setProgressText('Creating annotation...');

                const createdAnnotation = await createAnnotation({
                    source: 'neurosynth',
                    sourceId: undefined,
                    annotation: {
                        name: 'Annotation for Untitled sleuth project',
                        description: '',
                        note_keys: annotationNoteKeys,
                        notes: annotationNotes,
                        studyset: createdStudyset.data.id,
                    },
                });
                if (!createdAnnotation.data.id)
                    throw new Error('Created annotation but found no ID');

                setProgressValue(95);
                setProgressText('Finalizing project...');

                const createdProject = await createProjectHelper(
                    createdStudyset.data.id,
                    createdAnnotation.data.id,
                    uploads,
                    createProject
                );
                if (!createdProject.data.id) throw new Error('Created project but found no ID');

                setCreatedProjectComponents({
                    projectId: createdProject.data.id,
                    studysetId: createdStudyset.data.id,
                    annotationId: createdAnnotation.data.id,
                });

                setProgressValue(100);
                setProgressText('Complete...');
                setIsLoadingState(false);
            } catch (e) {
                console.error(e);
                setIsError(true);
            }
        };

        build(sleuthUploads);
    }, [
        createProject,
        createStudyVersion,
        createStudyset,
        ingestAsync,
        onNext,
        updateStudy,
        createAnnotation,
        sleuthUploads,
        user,
        queryImperatively,
        getPubMedIdFromDOI,
    ]);

    const handleNext = () => {
        if (
            !createdProjectComponents.projectId ||
            !createdProjectComponents.studysetId ||
            !createdProjectComponents.annotationId
        )
            return;

        onNext(
            createdProjectComponents.projectId,
            createdProjectComponents.studysetId,
            createdProjectComponents.annotationId
        );
    };

    return (
        <StateHandlerComponent isLoading={false} isError={isError}>
            <Box>
                {isLoadingState ? (
                    <Box
                        sx={{
                            height: '300px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                        }}
                    >
                        <Box sx={{ width: '100%' }}>
                            <LinearProgress
                                sx={{ height: '10px', marginTop: '2rem', marginBottom: '1rem' }}
                                variant="determinate"
                                value={progressValue}
                            />
                        </Box>
                        <Box
                            sx={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                            }}
                        >
                            <CircularProgress />
                            <Typography>{progressText}</Typography>
                            <Typography sx={{ marginTop: '1rem' }}>
                                (This may take a minute)
                            </Typography>
                        </Box>
                        {/* need this empty div to space out elements properly */}
                        <div></div>
                    </Box>
                ) : (
                    <Box>
                        <Box>
                            <Typography variant="h5" sx={{ marginBottom: '2rem' }}>
                                Import Complete
                            </Typography>
                            {sleuthUploads.map((upload, index) => {
                                const { numAnalyses, numCoordinates } = updateUploadSummary(upload);

                                return (
                                    <Box key={index} marginBottom="1rem">
                                        <Typography
                                            variant="h6"
                                            display="flex"
                                            gutterBottom
                                            alignItems="center"
                                            color="primary"
                                        >
                                            <InsertDriveFileIcon
                                                color="primary"
                                                sx={{ marginRight: '10px' }}
                                            />
                                            {upload.fileName}
                                        </Typography>
                                        <Typography>
                                            Successfully extracted and imported{' '}
                                            <b>{numCoordinates} coordinates </b>
                                            across <b>{numAnalyses} analyses</b>
                                        </Typography>
                                    </Box>
                                );
                            })}
                        </Box>
                        <Box sx={CurationImportBaseStyles.fixedContainer}>
                            <Box
                                sx={[
                                    CurationImportBaseStyles.fixedButtonsContainer,
                                    { justifyContent: 'flex-end' },
                                ]}
                            >
                                <Button
                                    variant="contained"
                                    sx={CurationImportBaseStyles.nextButton}
                                    disableElevation
                                    onClick={handleNext}
                                >
                                    next
                                </Button>
                            </Box>
                        </Box>
                    </Box>
                )}
            </Box>
        </StateHandlerComponent>
    );
};

export default SleuthImportWizardBuild;
