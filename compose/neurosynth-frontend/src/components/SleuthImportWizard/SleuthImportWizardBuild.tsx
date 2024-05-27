import { useAuth0 } from '@auth0/auth0-react';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import { Box, Button, CircularProgress, LinearProgress, Typography } from '@mui/material';
import { AxiosResponse } from 'axios';
import CurationImportBaseStyles from 'components/CurationComponents/CurationImport/CurationImportBase.styles';
import { EPropertyType } from 'components/EditMetadata';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import {
    useCreateAnnotation,
    useCreateProject,
    useCreateStudy,
    useCreateStudyset,
    useUpdateStudy,
} from 'hooks';
import { ICurationMetadata, IProvenance } from 'hooks/projects/useGetProjects';
import useIngest from 'hooks/studies/useIngest';
import {
    BaseStudy,
    BaseStudyReturn,
    NoteCollectionReturn,
    StudyReturn,
} from 'neurostore-typescript-sdk';
import { EExtractionStatus } from 'pages/ExtractionPage/ExtractionPage';
import {
    generateNewProjectData,
    initCurationHelper,
} from 'pages/Projects/ProjectPage/ProjectStore.helpers';
import { useEffect, useRef, useState } from 'react';
import {
    ISleuthFileUploadStubs,
    createUpdateRequestForEachSleuthStudy,
    executeHTTPRequestsAsBatches,
    sleuthIngestedStudiesToStubs,
    sleuthStubsToBaseStudies,
    updateUploadSummary,
} from './SleuthImportWizard.utils';

const SleuthImportWizardBuild: React.FC<{
    sleuthUploads: ISleuthFileUploadStubs[];
    onNext: (projectId: string, studysetId: string, annotationId: string) => void;
}> = (props) => {
    const { user } = useAuth0();
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

        const handleCreateProject = async (
            studysetId: string,
            annotationId: string,
            ingestRes: {
                responses: AxiosResponse<StudyReturn>[];
                fileName: string;
            }[]
        ) => {
            const fileNames = sleuthUploads.reduce((acc, curr, index) => {
                return index === 0 ? `${curr.fileName}` : `${acc}, ${curr.fileName}`;
            }, '');

            const newProjectData = generateNewProjectData(
                'Untitled sleuth project',
                `New project generated from files: ${fileNames}`
            );

            const curationMetadata: ICurationMetadata = initCurationHelper(
                ['not included', 'included'],
                false
            );

            curationMetadata.columns[curationMetadata.columns.length - 1].stubStudies =
                sleuthIngestedStudiesToStubs(ingestRes);

            const setStudyStatusesAsComplete = ingestRes
                .reduce((acc, curr) => {
                    return [...acc, ...curr.responses.map((x) => x.data.id as string)];
                }, [] as string[])
                .map((x) => ({
                    id: x,
                    status: EExtractionStatus.COMPLETED,
                }));

            return createProject({
                ...newProjectData,
                provenance: {
                    ...newProjectData.provenance,
                    curationMetadata: curationMetadata,
                    extractionMetadata: {
                        studyStatusList: setStudyStatusesAsComplete,
                        annotationId: annotationId,
                        studysetId: studysetId,
                    },
                    metaAnalysisMetadata: {
                        canEditMetaAnalyses: true,
                    },
                } as IProvenance,
            });
        };

        const handleCreateAnnotation = async (
            studysetId: string,
            ingestRes: {
                responses: AxiosResponse<StudyReturn>[];
                fileName: string;
            }[]
        ) => {
            // We want to use each filename as an inclusion column
            const noteKeys = ingestRes.reduce(
                (acc, curr) => {
                    acc[curr.fileName] = EPropertyType.BOOLEAN;
                    return acc;
                },
                { included: EPropertyType.BOOLEAN } as { [key: string]: EPropertyType }
            );

            const notes = ingestRes.reduce((acc, curr) => {
                const analysisStudyList: { analysisId: string; studyId: string }[] = [];
                for (const response of curr.responses) {
                    for (const analysis of response.data.analyses || []) {
                        analysisStudyList.push({
                            analysisId: analysis as string,
                            studyId: response.data.id as string,
                        });
                    }
                }

                const responsesToNotes: NoteCollectionReturn[] = analysisStudyList.map(
                    (studyAnalysis) => ({
                        analysis: studyAnalysis.analysisId,
                        study: studyAnalysis.studyId,
                        note: {
                            included: true,
                            [curr.fileName]: true,
                        },
                    })
                );

                return [...acc, ...responsesToNotes];
            }, [] as NoteCollectionReturn[]);

            return await createAnnotation({
                source: 'neurosynth',
                sourceId: undefined,
                annotation: {
                    name: 'Annotation for Untitled sleuth project',
                    description: '',
                    note_keys: noteKeys,
                    notes: notes,
                    studyset: studysetId,
                },
            });
        };

        const handleCreateStudyset = async (studyIds: string[]) => {
            return await createStudyset({
                name: `Studyset for Untitled sleuth project`,
                description: '',
                studies: studyIds,
            });
        };

        const ingest = async (
            baseStudies: BaseStudy[],
            sleuthUploads: ISleuthFileUploadStubs[]
        ) => {
            const res = await ingestAsync(baseStudies);
            const databaseResponses: {
                responses: AxiosResponse<StudyReturn>[];
                fileName: string;
            }[] = [];
            let index = 0;
            for (const sleuthUpload of sleuthUploads) {
                const requestList = createUpdateRequestForEachSleuthStudy(
                    res.data as BaseStudyReturn[],
                    sleuthUpload,
                    user!.sub as string
                );
                const percentageIncrement = 25 / sleuthUploads.length;
                const percentageAlreadyComplete = percentageIncrement * index;
                const responses = await executeHTTPRequestsAsBatches(requestList, (progress) => {
                    setProgressValue(
                        Math.round(
                            (progress / 100) * percentageIncrement + percentageAlreadyComplete
                        )
                    );
                });
                databaseResponses.push({
                    responses: responses,
                    fileName: sleuthUpload.fileName,
                });
                index++;
            }
            return databaseResponses;
        };

        const build = async (sleuthUploads: ISleuthFileUploadStubs[]) => {
            if (!user?.sub) return;
            const baseStudies = sleuthStubsToBaseStudies(sleuthUploads);
            try {
                setProgressValue(0);
                setProgressText('Ingesting...');

                const ingestRes = await ingest(baseStudies, sleuthUploads);
                const responsesToIds = ingestRes.reduce((acc, curr) => {
                    return [...acc, ...curr.responses.map((x) => x.data.id as string)];
                }, [] as string[]);
                setProgressValue(25);
                setProgressText('Creating studyset...');

                const createdStudyset = await handleCreateStudyset(responsesToIds);
                if (!createdStudyset.data.id) throw new Error('Created studyset but found no ID');
                setProgressValue(50);
                setProgressText('Creating annotation...');

                const createdAnnotation = await handleCreateAnnotation(
                    createdStudyset.data.id as string,
                    ingestRes
                );
                setProgressValue(75);
                setProgressText('Finalizing project...');

                if (!createdAnnotation.data.id)
                    throw new Error('Created annotation but found no ID');
                const createdProject = await handleCreateProject(
                    createdStudyset.data.id,
                    createdAnnotation.data.id,
                    ingestRes
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
    ]);

    const handleNext = () => {
        if (!createdProjectComponents) return;

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
