import { Box, CircularProgress, LinearProgress, Typography } from '@mui/material';
import { EPropertyType } from 'components/EditMetadata';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import { useCreateAnnotation, useCreateStudyset, useUpdateStudyset } from 'hooks';
import useIngest from 'hooks/studies/useIngest';
import { BaseStudy, BaseStudyReturn } from 'neurostore-typescript-sdk';
import { useSnackbar } from 'notistack';
import {
    useProjectCurationColumn,
    useProjectDescription,
    useProjectExtractionAnnotationId,
    useProjectExtractionStudysetId,
    useProjectId,
    useProjectName,
    useProjectNumCurationColumns,
    useUpdateExtractionMetadata,
} from 'pages/Projects/ProjectPage/ProjectStore';
import { setAnalysesInAnnotationAsIncluded } from 'pages/helpers/utils';
import { useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';
import BaseDialog, { IDialog } from '../BaseDialog';
import MoveToExtractionIntroduction from './MoveToExtractionIntroduction';
import { selectBestVersionsForStudyset } from './MovetoExtractionDialog.helpers';

const MoveToExtractionDialog: React.FC<IDialog> = (props) => {
    const numColumns = useProjectNumCurationColumns();
    const curationIncludedStudies = useProjectCurationColumn(numColumns - 1);
    const projectId = useProjectId();
    const projectName = useProjectName();
    const projectDescription = useProjectDescription();
    const { mutateAsync: createStudyset } = useCreateStudyset();
    const { mutateAsync: createAnnotation } = useCreateAnnotation();
    const updateExtractionMetadata = useUpdateExtractionMetadata();
    const studysetId = useProjectExtractionStudysetId();
    const annotationId = useProjectExtractionAnnotationId();
    const { enqueueSnackbar } = useSnackbar();
    const { mutateAsync: asyncIngest } = useIngest();
    const { mutateAsync: asyncUpdateStudyset } = useUpdateStudyset();

    const history = useHistory();

    const [isLoadingPhase, setIsLoadingPhase] = useState(false);
    const [isError, setIsError] = useState(false);
    const [loadingStatus, setLoadingStatus] = useState<{
        createdStudyset: boolean;
        createdAnnotations: boolean;
        ingested: boolean;
    }>({
        createdStudyset: false,
        createdAnnotations: false,
        ingested: false,
    });

    const handleCloseDialog = () => {
        setIsLoadingPhase(false);
        setLoadingStatus({
            createdAnnotations: false,
            createdStudyset: false,
            ingested: false,
        });
        props.onCloseDialog();
    };

    const handleCreateStudyset = async (): Promise<string> => {
        try {
            let tempStudysetId: string;
            if (studysetId) {
                tempStudysetId = studysetId;
            } else {
                const newStudyset = await createStudyset({
                    name: `Studyset for ${projectName}`,
                    description: projectDescription,
                });

                const newStudysetId = newStudyset.data.id;
                if (!newStudysetId)
                    throw new Error('expected a studyset id but did not receive one');

                tempStudysetId = newStudysetId;

                updateExtractionMetadata({
                    studysetId: newStudysetId,
                    studyStatusList: [],
                });
            }
            setLoadingStatus((prev) => ({
                ...prev,
                createdStudyset: true,
            }));
            return tempStudysetId;
        } catch (e) {
            console.error(e);
            throw new Error('there was an error creating the studyset');
        }
    };

    const handleCreateAnnotations = async (newStudysetId: string): Promise<string> => {
        if (!newStudysetId) throw new Error('cannot create annotations without a studyset id');

        try {
            let tempAnnotationId: string;
            if (annotationId) {
                tempAnnotationId = annotationId;
            } else {
                const newAnnotation = await createAnnotation({
                    source: 'neurosynth',
                    sourceId: undefined,
                    annotation: {
                        name: `Annotation for studyset ${newStudysetId}`,
                        description: '',
                        note_keys: { included: EPropertyType.BOOLEAN },
                        studyset: newStudysetId,
                    },
                });

                const newAnnotationId = newAnnotation.data.id;
                if (!newAnnotationId)
                    throw new Error('expected a studyset id but did not receive one');

                tempAnnotationId = newAnnotationId;
                updateExtractionMetadata({
                    annotationId: newAnnotationId,
                });
            }
            setLoadingStatus((prev) => ({
                ...prev,
                createdAnnotations: true,
            }));
            return tempAnnotationId;
        } catch (e) {
            console.error(e);
            throw new Error('there was an error creating the studyset');
        }
    };

    const handleIngest = async (newStudysetId: string, newAnnotationId: string) => {
        if (!newStudysetId || !newAnnotationId) return;
        const includedStubs = curationIncludedStudies.stubStudies;

        // the BE ingestion only checks for these three properties
        const stubsToBaseStudies: Array<
            Pick<
                BaseStudy,
                'name' | 'doi' | 'pmid' | 'year' | 'description' | 'publication' | 'authors'
            >
        > = includedStubs.map((stub) => ({
            name: stub.title,
            doi: stub.doi,
            pmid: stub.pmid,
            year: Number(stub.articleYear),
            description: stub.abstractText,
            publication: stub.journal,
            authors: stub.authors,
        }));

        try {
            const res = await asyncIngest(stubsToBaseStudies);
            const returnedBaseStudies = res.data as Array<BaseStudyReturn>;

            const selectedStudyIds = selectBestVersionsForStudyset(returnedBaseStudies);
            await asyncUpdateStudyset({
                studysetId: newStudysetId,
                studyset: {
                    studies: selectedStudyIds,
                },
            });

            await setAnalysesInAnnotationAsIncluded(newAnnotationId);
            setLoadingStatus((prev) => ({
                ...prev,
                ingested: true,
            }));
        } catch (e) {
            console.error(e);
            throw new Error('there was an error ingesting');
        }
    };

    const handleInitialize = async () => {
        setIsLoadingPhase(true);

        try {
            const newStudysetId = await handleCreateStudyset();
            const newAnnotationId = await handleCreateAnnotations(newStudysetId);
            await handleIngest(newStudysetId, newAnnotationId);
            handleFinalize();
        } catch (e) {
            console.error(e);
            setIsError(true);
            enqueueSnackbar('there was an error moving to extraction', { variant: 'error' });
        }
    };

    const handleFinalize = () => {
        // small delay so that user can see the completed progress bar and final message
        setTimeout(() => {
            props.onCloseDialog();
            history.push(`/projects/${projectId}/extraction`);
        }, 1000);
    };

    const progress = useMemo(() => {
        const createdStudyset = +loadingStatus.createdStudyset;
        const createdAnnotations = +loadingStatus.createdAnnotations;
        const ingested = +loadingStatus.ingested;
        return (100 * (createdStudyset + createdAnnotations + ingested)) / 3;
    }, [loadingStatus]);

    const progressText = useMemo(() => {
        const createdStudyset = +loadingStatus.createdStudyset;
        const createdAnnotations = +loadingStatus.createdAnnotations;
        const ingested = +loadingStatus.ingested;
        const sum = createdStudyset + createdAnnotations + ingested;
        if (sum === 0) return 'creating studyset...';
        if (sum === 1) return 'creating annotations...';
        if (sum === 2) return 'ingesting...';
        if (sum === 3) return 'process complete';
    }, [loadingStatus.createdAnnotations, loadingStatus.createdStudyset, loadingStatus.ingested]);

    return (
        <BaseDialog
            dialogTitle="Extraction Phase: Get Started"
            isOpen={props.isOpen}
            fullWidth
            maxWidth="md"
            onCloseDialog={handleCloseDialog}
        >
            <StateHandlerComponent isLoading={false} isError={isError}>
                {isLoadingPhase ? (
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
                                sx={{ height: '10px', marginBottom: '1rem' }}
                                variant="determinate"
                                value={progress}
                            />
                        </Box>
                        <Box
                            sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
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
                    <MoveToExtractionIntroduction onNext={handleInitialize} />
                )}
            </StateHandlerComponent>
        </BaseDialog>
    );
};

export default MoveToExtractionDialog;
