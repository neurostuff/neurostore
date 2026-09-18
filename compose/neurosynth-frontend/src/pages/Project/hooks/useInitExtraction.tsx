import { EPropertyType } from 'components/EditMetadata/EditMetadata.types';
import { getDefaultForNoteKey } from 'components/HotTables/HotTables.utils';
import { mapStubsToStudysetPayload } from 'helpers/Extraction.helpers';
import { useCreateAnnotation, useCreateStudyset, useIngest, useUpdateStudyset } from 'hooks';
import { EAnalysisType } from 'hooks/projects/Project.types';
import { BaseStudyReturnInfo } from 'hooks/studies/studyQueries.types';
import { BaseStudy } from 'neurostore-typescript-sdk';
import { useSnackbar } from 'notistack';
import { EExtractionStatus } from 'pages/Extraction/Extraction.types';
import { SearchDataType } from 'pages/Study/Study.types';
import { useMemo, useState } from 'react';
import {
    useProjectAnalysisType,
    useProjectCurationColumn,
    useProjectDescription,
    useProjectExtractionAnnotationId,
    useProjectExtractionStudysetId,
    useProjectName,
    useProjectNumCurationColumns,
    useUpdateExtractionMetadata,
} from 'stores/projects/ProjectStore';

type ExtractionLoadingStatus = {
    createdStudyset: boolean;
    createdAnnotations: boolean;
    ingested: boolean;
};

const INITIAL_LOADING_STATUS: ExtractionLoadingStatus = {
    createdStudyset: false,
    createdAnnotations: false,
    ingested: false,
};

const useInitExtraction = () => {
    const numColumns = useProjectNumCurationColumns();
    const curationIncludedStudies = useProjectCurationColumn(numColumns - 1);
    const projectName = useProjectName();
    const projectDescription = useProjectDescription();
    const projectAnalysisType = useProjectAnalysisType();
    const { mutateAsync: createStudyset } = useCreateStudyset();
    const { mutateAsync: createAnnotation } = useCreateAnnotation();
    const updateExtractionMetadata = useUpdateExtractionMetadata();
    const studysetId = useProjectExtractionStudysetId();
    const annotationId = useProjectExtractionAnnotationId();
    const { enqueueSnackbar } = useSnackbar();
    const { mutateAsync: asyncIngest } = useIngest();
    const { mutateAsync: asyncUpdateStudyset } = useUpdateStudyset();

    const [isError, setIsError] = useState(false);
    const [loadingStatus, setLoadingStatus] = useState<ExtractionLoadingStatus>(INITIAL_LOADING_STATUS);

    const handleCreateStudyset = async (): Promise<string> => {
        try {
            let tempStudysetId: string;
            if (studysetId) {
                tempStudysetId = studysetId;
            } else {
                const newStudyset = await createStudyset({
                    name: `${projectName} Studyset`,
                    description: projectDescription,
                });

                const newStudysetId = newStudyset.data.id;
                if (!newStudysetId) throw new Error('expected a studyset id but did not receive one');

                tempStudysetId = newStudysetId;
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
                        note_keys: {
                            included: {
                                type: EPropertyType.BOOLEAN,
                                order: 0,
                                default: getDefaultForNoteKey('included', EPropertyType.BOOLEAN),
                            },
                        },
                        studyset: newStudysetId,
                    },
                });

                const newAnnotationId = newAnnotation.id;
                if (!newAnnotationId) throw new Error('expected a studyset id but did not receive one');

                tempAnnotationId = newAnnotationId;
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

    const handleIngest = async (newStudysetId: string, newAnnotationId: string, setStudiesAsComplete: boolean) => {
        if (!newStudysetId || !newAnnotationId) return;
        const includedStubs = curationIncludedStudies.stubStudies;

        const stubsToBaseStudies: Array<
            Pick<
                BaseStudy,
                'name' | 'doi' | 'pmid' | 'pmcid' | 'year' | 'description' | 'publication' | 'authors' | 'level'
            >
        > = includedStubs.map((stub) => ({
            name: stub.title,
            doi: stub.doi ? stub.doi : undefined,
            pmid: stub.pmid ? stub.pmid : undefined,
            pmcid: stub.pmcid ? stub.pmcid : undefined,
            year: Number(stub.articleYear),
            description: stub.abstractText,
            publication: stub.journal,
            authors: stub.authors,
            level: 'group',
        }));

        try {
            const res = await asyncIngest(stubsToBaseStudies);
            const returnedBaseStudies = res.data as Array<BaseStudyReturnInfo>;

            const studiesPayload = mapStubsToStudysetPayload(
                includedStubs,
                returnedBaseStudies,
                undefined,
                projectAnalysisType === EAnalysisType.IBMA ? SearchDataType.IMAGE : SearchDataType.COORDINATE
            );

            updateExtractionMetadata({
                studysetId: newStudysetId,
                annotationId: newAnnotationId,
                studyStatusList: studiesPayload.map((study) => ({
                    id: study.id,
                    status: setStudiesAsComplete ? EExtractionStatus.COMPLETED : EExtractionStatus.UNCATEGORIZED,
                })),
            });

            await asyncUpdateStudyset({
                studysetId: newStudysetId,
                studyset: {
                    studies: studiesPayload,
                },
            });

            setLoadingStatus((prev) => ({
                ...prev,
                ingested: true,
            }));
        } catch (e) {
            console.error(e);
            throw new Error('there was an error ingesting');
        }
    };

    // if setStudiesAsComplete is true, the studies will be set as complete after ingestion. This is for the skip extraction flow
    const doExtraction = async (setStudiesAsComplete: boolean) => {
        setIsError(false);

        try {
            const newStudysetId = await handleCreateStudyset();
            const newAnnotationId = await handleCreateAnnotations(newStudysetId);

            await handleIngest(newStudysetId, newAnnotationId, setStudiesAsComplete);
            return true;
        } catch (e) {
            console.error(e);
            setIsError(true);
            enqueueSnackbar('there was an error moving to extraction', { variant: 'error' });
            return false;
        }
    };

    const reset = () => {
        setLoadingStatus(INITIAL_LOADING_STATUS);
        setIsError(false);
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

    return {
        doExtraction,
        progress,
        progressText,
        isError,
        reset,
    };
};

export default useInitExtraction;
