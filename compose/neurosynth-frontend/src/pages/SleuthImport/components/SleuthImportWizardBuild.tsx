import { useAuth0 } from '@auth0/auth0-react';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import { Box, Button, CircularProgress, LinearProgress, Typography } from '@mui/material';
import { EPropertyType } from 'components/EditMetadata/EditMetadata.types';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import { useCreateAnnotation, useCreateProject, useCreateStudyset, useUpdateStudy } from 'hooks';
import useGetPubMedIdFromDOI from 'hooks/external/useGetPubMedIdFromDOI';
import useGetPubmedIDs from 'hooks/external/useGetPubMedIds';
import useIngest from 'hooks/studies/useIngest';
import { BaseStudy, NoteCollectionReturn } from 'neurostore-typescript-sdk';
import { EExtractionStatus } from 'pages/Extraction/ExtractionPage';
import { useEffect, useRef, useState } from 'react';
import {
    ISleuthFileUploadStubs,
    applyPubmedStudyDetailsToBaseStudiesAndRemoveDuplicates,
    createProjectHelper,
    generateAnnotationForSleuthImport,
    ingestBaseStudies,
    lookForPMIDsAndFetchStudyDetails,
    sleuthStubsToBaseStudies,
    updateUploadSummary,
} from '../SleuthImport.helpers';
import CurationImportStyles from 'pages/CurationImport/components/CurationImport.styles';

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

                const allAnnotationNotes: NoteCollectionReturn[] = [];
                let allAnnotationNoteKeys: { [key: string]: EPropertyType } = {
                    included: EPropertyType.BOOLEAN,
                };
                const uploads: {
                    fileName: string;
                    studyAnalysisList: {
                        studyId: string;
                        analysisId: string;
                        doi: string;
                        pmid: string;
                    }[];
                    baseStudySleuthstubsWithDetails: BaseStudy[];
                }[] = [];

                let index = 0;
                const percentageIncrement = 80 / sleuthUploads.length;
                for (const sleuthUpload of sleuthUploads) {
                    setProgressText(
                        `Fetching study details for studies within ${sleuthUpload.fileName} (if they exist)...`
                    );
                    let percentageAlreadyComplete = index * percentageIncrement;
                    // 1. convert sleuth stubs to a format neurosynth compose recognizes
                    const baseStudySleuthStubs = sleuthStubsToBaseStudies(sleuthUpload.sleuthStubs);

                    // 2. query pubmed for PMIDs based on the DOIs supplied. Fetch studies by PMIDs
                    const pubmedArticlesForSleuthStubs = await lookForPMIDsAndFetchStudyDetails(
                        baseStudySleuthStubs,
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

                    setProgressText(
                        `Adding studies from ${sleuthUpload.fileName} into the database...`
                    );

                    // 3. From the previous step, take our initial undetailed base studies and add details from pubmed
                    // Remove duplicates. The ingestion endpoint will take these base studies and either
                    // (1) create a new study with a version if one does not exist or (2) return an existing study
                    const baseStudiesWithPubmedDetailsNoDuplicates =
                        applyPubmedStudyDetailsToBaseStudiesAndRemoveDuplicates(
                            baseStudySleuthStubs,
                            pubmedArticlesForSleuthStubs
                        );

                    // 4. ingest the base studies and consolidate the sleuth stubs into Studies.
                    // If N sleuth stubs have the same DOI/PMID, then a study object is created, with N analyses representing each sleuth stub
                    const studyAnalysisObjects = await ingestBaseStudies(
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

                    const { noteKeys, notes } = generateAnnotationForSleuthImport(
                        studyAnalysisObjects,
                        sleuthUpload.fileName
                    );
                    allAnnotationNoteKeys = { ...allAnnotationNoteKeys, ...noteKeys };
                    allAnnotationNotes.push(...notes);

                    uploads.push({
                        fileName: sleuthUpload.fileName,
                        studyAnalysisList: studyAnalysisObjects,
                        baseStudySleuthstubsWithDetails: baseStudiesWithPubmedDetailsNoDuplicates,
                    });
                    index++;
                }

                // for multiple files, some annotation notes do not have all of the keys in the note object set, however
                // the backend expects all note objects to have the properties that exist within noteKeys
                Object.keys(allAnnotationNoteKeys).forEach((key) => {
                    allAnnotationNotes.forEach((noteObject) => {
                        const note = noteObject.note as { [key: string]: boolean };
                        if (!note[key]) {
                            note[key] = false;
                        }
                    });
                });

                setProgressValue(85);
                setProgressText('Creating studyset...');

                const createdStudyset = await createStudyset({
                    name: `Studyset for Untitled sleuth project`,
                    description: '',
                    studies: uploads.reduce((acc, curr) => {
                        return [...acc, ...curr.studyAnalysisList.map((study) => study.studyId)];
                    }, [] as string[]),
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
                        note_keys: allAnnotationNoteKeys,
                        notes: allAnnotationNotes,
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

                // set chip to completed in extraction page so that user is automatically brought to completed studies by default
                const selectedChipLocalStorageKey = `SELECTED_CHIP-${createdProject.data.id}`;
                localStorage.setItem(selectedChipLocalStorageKey, EExtractionStatus.COMPLETED);

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
                        <Box sx={CurationImportStyles.fixedContainer}>
                            <Box
                                sx={[
                                    CurationImportStyles.fixedButtonsContainer,
                                    { justifyContent: 'flex-end' },
                                ]}
                            >
                                <Button
                                    variant="contained"
                                    sx={CurationImportStyles.nextButton}
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
