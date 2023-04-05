import { Box, Button, CircularProgress, Link, Typography } from '@mui/material';
import NavigationButtons from 'components/Buttons/NavigationButtons/NavigationButtons';
import ReadOnlyStubSummary from 'components/CurationComponents/CurationImport/ReadOnlyStubSummary';
import { ICurationStubStudy } from 'components/CurationComponents/CurationStubStudy/CurationStubStudyDraggableContainer';
import { useGetStudysetById, useUpdateStudyset } from 'hooks';
import useGetProjectById from 'hooks/requests/useGetProjectById';
import { StudyReturn } from 'neurostore-typescript-sdk';
import { useSnackbar } from 'notistack';
import {
    useProjectCurationColumn,
    useProjectNumCurationColumns,
} from 'pages/Projects/ProjectPage/ProjectStore';
import { useEffect, useState, useRef } from 'react';
import { useQueryClient } from 'react-query';
import { useParams } from 'react-router-dom';
import API from 'utils/api';

const IngestionStep: React.FC<{ onNext: () => void }> = (props) => {
    const numColumns = useProjectNumCurationColumns();
    const includedStudies = useProjectCurationColumn(numColumns - 1);

    const { projectId }: { projectId: string | undefined } = useParams();
    const queryClient = useQueryClient();
    const {
        data: project,
        isLoading: getProjectIsLoading,
        isError: getProjectIsError,
    } = useGetProjectById(projectId);
    const {
        data: studyset,
        isLoading: getStudysetIsLoading,
        isError: getStudysetIsError,
    } = useGetStudysetById(project?.provenance?.extractionMetadata?.studysetId || undefined, false);
    const { mutateAsync } = useUpdateStudyset();
    const { enqueueSnackbar } = useSnackbar();

    const ingestionProgressRef = useRef<{
        currentStubIndex: number;
        studyList: string[];
        stubsToIngest: ICurationStubStudy[];
    }>({
        currentStubIndex: 0,
        studyList: [],
        stubsToIngest: [],
    });
    const [ingestionProgress, setIngestionProgress] = useState({
        currentStubIndex: 0,
        totalStubsToIngest: 0,
    });

    const [ingestionStatus, setIngestionStatus] = useState<{
        ingestionCondition: 'COMPLETE' | 'NOTSTARTED' | 'INPROGRESS' | 'ERROR';
        isIngesting: boolean;
    }>({
        ingestionCondition: 'NOTSTARTED',
        isIngesting: false,
    });

    const [ingestionView, setIngestionView] = useState<{
        stubToIngest: ICurationStubStudy | undefined;
        existingStudies: StudyReturn[] | undefined;
    }>({
        stubToIngest: undefined,
        existingStudies: undefined,
    });

    useEffect(() => {
        if (
            project?.provenance?.curationMetadata?.columns &&
            project.provenance.curationMetadata.columns.length > 0
        ) {
            const inclusionColumn =
                project.provenance.curationMetadata.columns[
                    project.provenance.curationMetadata.columns.length - 1
                ];

            ingestionProgressRef.current.stubsToIngest = inclusionColumn.stubStudies;
            setIngestionProgress((prev) => ({
                ...prev,
                totalStubsToIngest: inclusionColumn.stubStudies.length,
            }));
        }
    }, [project]);

    useEffect(() => {
        setIngestionProgress((prev) => ({
            ...prev,
            currentStubIndex: ingestionProgressRef.current.currentStubIndex,
        }));
    }, [ingestionProgressRef.current.currentStubIndex]);

    const handleIngestionComplete = () => {
        setIngestionStatus({
            ingestionCondition: 'COMPLETE',
            isIngesting: false,
        });
    };

    const setView = (stub: ICurationStubStudy, studies: StudyReturn[]) => {
        setIngestionStatus((prev) => ({ ...prev, isIngesting: false }));
        setIngestionView({
            stubToIngest: stub,
            existingStudies: studies,
        });
    };

    const addStudyToStudyset = async (study: StudyReturn) => {
        try {
            // 2. add the stub to the studyset
            const updatedStudyset = await mutateAsync({
                studysetId: project?.provenance?.extractionMetadata?.studysetId || '',
                studyset: {
                    studies: [...ingestionProgressRef.current.studyList, study.id as string],
                },
            });

            // 3. increment currentStubIndex to next
            ingestionProgressRef.current.studyList = updatedStudyset.data.studies as string[];
            ingestionProgressRef.current.currentStubIndex++;

            // 4. start the ingestion process for the next stub
            await startIngestionProcess();
        } catch (e) {
            throw new Error('error adding study to studyset');
        }
    };

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
                    metadata: stub.articleLink ? { articleLink: stub.articleLink } : {},
                }
            );

            await addStudyToStudyset(createdStudy.data);
        } catch (e) {
            throw new Error('error creating study from stub');
        }
    };

    const ingest = async () => {
        const { currentStubIndex, stubsToIngest } = ingestionProgressRef.current;
        const stubToIngest = stubsToIngest[currentStubIndex];
        const study = await API.NeurostoreServices.StudiesService.studiesGet(
            stubToIngest.pmid,
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

        const databaseHasStubAlready = (study.data.results || []).length > 0;
        if (databaseHasStubAlready) {
            setView(stubToIngest, study.data.results as StudyReturn[]);
        } else {
            try {
                await createStudyFromStub(stubToIngest);
            } catch (e) {
                throw new Error('there was an error ingesting the study');
            }
        }
    };

    const startIngestionProcess = async () => {
        if (
            projectId &&
            project?.provenance?.curationMetadata?.columns &&
            project.provenance.curationMetadata.columns.length > 0 &&
            studyset?.studies
        ) {
            const hasFinishedIngestion =
                ingestionProgressRef.current.currentStubIndex >=
                ingestionProgressRef.current.stubsToIngest.length;
            if (hasFinishedIngestion) {
                setIngestionStatus({
                    ingestionCondition: 'COMPLETE',
                    isIngesting: false,
                });

                handleIngestionComplete();
            } else {
                setIngestionStatus({
                    ingestionCondition: 'INPROGRESS',
                    isIngesting: true,
                });
                try {
                    await ingest();
                } catch (e) {
                    setIngestionStatus({
                        ingestionCondition: 'ERROR',
                        isIngesting: false,
                    });
                }
            }
        }
    };

    switch (ingestionStatus.ingestionCondition) {
        case 'NOTSTARTED':
            return (
                <Button
                    sx={{ display: 'block', margin: '2rem auto' }}
                    variant="contained"
                    onClick={() => startIngestionProcess()}
                >
                    start ingestion process
                </Button>
            );
        case 'COMPLETE':
            return (
                <Box>
                    <Typography
                        sx={{ marginBottom: '1rem', color: 'success.main', textAlign: 'center' }}
                        gutterBottom
                        variant="h6"
                    >
                        Ingestion Complete
                    </Typography>
                    <NavigationButtons
                        onButtonClick={props.onNext}
                        prevButtonDisabled
                        nextButtonStyle="outlined"
                    />
                </Box>
            );
        case 'INPROGRESS':
            if (ingestionStatus.isIngesting) {
                return (
                    <Box
                        sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <Typography gutterBottom variant="h5">
                            Ingesting{' '}
                            {`${(ingestionProgress.currentStubIndex || 0) + 1} / ${
                                ingestionProgress.totalStubsToIngest
                            }`}
                        </Typography>
                        <CircularProgress />
                    </Box>
                );
            } else {
                return (
                    <Box>
                        <Box>
                            <Typography sx={{ textAlign: 'center' }} gutterBottom variant="h5">
                                Ingesting{' '}
                                {`${(ingestionProgress.currentStubIndex || 0) + 1} / ${
                                    ingestionProgress.totalStubsToIngest
                                }`}
                            </Typography>
                            <Typography>
                                We encountered a study that exists in neurosynth-compose already.
                                You can choose whether to ignore the existing study and ingest
                                anyway, or select the existing study to add to your studyset
                                instead.
                            </Typography>
                        </Box>
                        <Box sx={{ marginTop: '1rem' }}>
                            <Typography variant="h6">Your Study</Typography>
                            {ingestionView.stubToIngest && (
                                <Box
                                    sx={{
                                        backgroundColor: '#f3f3f3',
                                        borderRadius: '8px',
                                        padding: '10px',
                                    }}
                                >
                                    <ReadOnlyStubSummary {...ingestionView.stubToIngest} />
                                    <Button
                                        onClick={() =>
                                            createStudyFromStub(
                                                ingestionView.stubToIngest as ICurationStubStudy
                                            )
                                        }
                                        color="secondary"
                                        variant="outlined"
                                        size="small"
                                    >
                                        Ignore existing studies and ingest
                                    </Button>
                                </Box>
                            )}
                        </Box>
                        <Box sx={{ marginTop: '2rem' }}>
                            <Typography variant="h6" gutterBottom sx={{ marginBottom: '0.5rem' }}>
                                Existing Studies in Neurosynth-Compose (click the title to view in a
                                new page):
                            </Typography>
                            {(ingestionView.existingStudies || []).map((study, index) => (
                                <Box
                                    key={study.id || index}
                                    sx={{
                                        backgroundColor: '#f3f3f3',
                                        borderRadius: '8px',
                                        padding: '10px',
                                        marginBottom: '1.5rem',
                                    }}
                                >
                                    <Link
                                        sx={{ fontSize: '1.25rem' }}
                                        rel="noopener"
                                        underline="hover"
                                        color="primary"
                                        target="_blank"
                                        href={`http://localhost:3000/studies/${study.id}`}
                                    >
                                        {study.name}
                                    </Link>
                                    <Button
                                        onClick={() => addStudyToStudyset(study)}
                                        sx={{ marginTop: '0.5rem', display: 'block' }}
                                        size="small"
                                        color="secondary"
                                        variant="outlined"
                                    >
                                        Add this study to your studyset
                                    </Button>
                                </Box>
                            ))}
                        </Box>
                    </Box>
                );
            }
        // eslint-disable-next-line no-fallthrough
        case 'ERROR':
        default:
            return (
                <Box>
                    <Typography color="error">There was an error ingesting studies</Typography>
                </Box>
            );
    }
};

export default IngestionStep;
