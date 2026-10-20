import { useAuth0 } from '@auth0/auth0-react';
import { noteKeyArrToObj } from 'components/HotTables/HotTables.utils';
import { unsetUnloadHandler } from 'helpers/BeforeUnload.helpers';
import {
    useCreateStudy,
    useGetStudysetNonNestedById,
    useUpdateAnnotationByAnnotationAndAnalysisIds,
    useUpdateAnnotationById,
    useUpdateStudyset,
} from 'hooks';
import { AnalysisReturn, StudyRequest } from 'neurostore-typescript-sdk';
import { useSnackbar } from 'notistack';
import {
    useProjectExtractionAnnotationId,
    useProjectExtractionReplaceStudyListStatusId,
    useProjectExtractionStudysetId,
    useProjectId,
} from 'stores/projects/ProjectStore';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import API from 'api/api.config';
import { arrayToMetadata } from 'pages/StudyCBMA/components/EditStudyMetadata';
import { StudyAnnotationEdits, StudyAnnotationsTableHandle } from 'pages/StudyCBMA/context/StudyCBMAContext';
import {
    useStudy,
    useStudyAnalyses,
    useStudyHasBeenEdited,
    useStudyUser,
    useUpdateStudyInDB,
    useUpdateStudyIsLoading,
} from 'stores/study/StudyStore';
import { storeAnalysesToStudyAnalyses } from 'stores/study/StudyStore.helpers';
import { hasDuplicateStudyAnalysisNames, hasEmptyStudyPoints } from './useSaveStudy.helpers';
import { updateExtractionTableStateStudySwapInStorage } from 'pages/Extraction/components/ExtractionTable.helpers';
import annotationQueries from 'hooks/annotations/annotationQueries';
import studysetQueries from 'hooks/studysets/studysetQueries';

const annotationEditsHaveChanges = (
    annotationEdits: StudyAnnotationEdits | undefined
): annotationEdits is StudyAnnotationEdits =>
    !!annotationEdits && (annotationEdits.noteKeysHaveChanged || annotationEdits.editedRowIndexes.size > 0);

/** Called once by StudyCBMAProvider, which passes in the study annotations table and its edit flag. */
const useSaveStudy = (
    studyAnnotationsTableRef: React.RefObject<StudyAnnotationsTableHandle | null>,
    annotationHasEdits: boolean,
    setAnnotationHasEdits: (hasEdits: boolean) => void
) => {
    const { user } = useAuth0();
    const queryClient = useQueryClient();
    const { enqueueSnackbar } = useSnackbar();
    const navigate = useNavigate();

    // project stuff
    const replaceStudyWithNewClonedStudy = useProjectExtractionReplaceStudyListStatusId();
    const studysetId = useProjectExtractionStudysetId();
    const annotationId = useProjectExtractionAnnotationId();
    const projectId = useProjectId();
    // study stuff
    const storeStudy = useStudy();
    const studyOwnerUser = useStudyUser();
    const updateStudyIsLoading = useUpdateStudyIsLoading();
    const studyHasBeenEdited = useStudyHasBeenEdited();
    const analyses = useStudyAnalyses();
    const updateStudyInDB = useUpdateStudyInDB();
    // annotation stuff
    const { mutateAsync: updateAnnotation, isPending: updateAnnotationIsLoading } =
        useUpdateAnnotationById(annotationId);
    const { mutateAsync: updateAnnotationAnalyses, isPending: updateAnnotationAnalysesIsLoading } =
        useUpdateAnnotationByAnnotationAndAnalysisIds(annotationId);

    const { data: studyset } = useGetStudysetNonNestedById(studysetId);
    const { mutateAsync: updateStudyset } = useUpdateStudyset();
    const { mutateAsync: createStudy } = useCreateStudy();

    const [isCloning, setIsCloning] = useState(false);

    // PUT the whole annotation when the columns changed, otherwise POST only the edited rows
    const updateAnnotationInDB = async (annotationEdits: StudyAnnotationEdits) => {
        if (!annotationId) throw new Error('no annotation id');

        if (annotationEdits.noteKeysHaveChanged) {
            await updateAnnotation({
                argAnnotationId: annotationId,
                annotation: {
                    note_keys: noteKeyArrToObj(annotationEdits.noteKeys),
                    notes: annotationEdits.rows.map((row) => ({
                        analysis: row.analysis,
                        study: row.study,
                        note: row.note,
                    })),
                },
            });
        } else {
            await updateAnnotationAnalyses(
                annotationEdits.rows
                    .filter((_, rowIndex) => annotationEdits.editedRowIndexes.has(rowIndex))
                    .map((row) => ({
                        id: `${annotationId}_${row.analysis}`,
                        note: row.note,
                    }))
            );
        }
    };

    const handleUpdateDB = async (annotationEdits: StudyAnnotationEdits | undefined) => {
        const annotationHasChanges = annotationEditsHaveChanges(annotationEdits);
        try {
            if (studyHasBeenEdited) {
                // new analyses have temporary ids until the study save creates them. Analysis names are unique,
                // so each saved analysis is found by the name it had before saving
                const tempIdToAnalysisName = new Map(
                    (annotationEdits?.rows ?? [])
                        .filter((row) => row.isNew)
                        .map((row) => [
                            row.analysis,
                            analyses.find((analysis) => analysis.id === row.analysis)?.name,
                        ])
                );
                const updatedStudy = await updateStudyInDB();
                const tempIdToAnalysisId = new Map<string, string>();
                tempIdToAnalysisName.forEach((analysisName, temporaryAnalysisId) => {
                    const savedAnalysis = ((updatedStudy.analyses || []) as AnalysisReturn[]).find(
                        (analysis) => analysis.name === analysisName
                    );
                    if (savedAnalysis?.id) tempIdToAnalysisId.set(temporaryAnalysisId, savedAnalysis.id);
                });

                if (annotationHasChanges) {
                    await updateAnnotationInDB({
                        ...annotationEdits,
                        rows: annotationEdits.rows.map((row) => ({
                            ...row,
                            analysis: tempIdToAnalysisId.get(row.analysis) ?? row.analysis,
                        })),
                    });
                }
                studyAnnotationsTableRef.current?.markSaved(tempIdToAnalysisId);
                enqueueSnackbar(annotationHasChanges ? 'Study and annotation saved' : 'Study saved', {
                    variant: 'success',
                });
            } else if (annotationHasChanges) {
                await updateAnnotationInDB(annotationEdits);
                studyAnnotationsTableRef.current?.markSaved();
                enqueueSnackbar('Annotation saved', { variant: 'success' });
            }

            setAnnotationHasEdits(false);
            unsetUnloadHandler('study');
            queryClient.invalidateQueries({
                queryKey: ['studies'],
            });
            queryClient.invalidateQueries({
                queryKey: ['annotations'],
            });
        } catch (e) {
            console.error(e);
            enqueueSnackbar('There was an error saving to the database', {
                variant: 'error',
            });
        }
    };

    const getNewScrubbedStudyFromStore = () => {
        const updatedStudy: StudyRequest = {
            name: storeStudy.name,
            description: storeStudy.description,
            doi: storeStudy.doi,
            pmid: storeStudy.pmid,
            metadata: arrayToMetadata(storeStudy.metadata),
            publication: storeStudy.publication,
            authors: storeStudy.authors,
            year: storeStudy.year,
            analyses: storeAnalysesToStudyAnalyses(storeStudy.analyses),
        };

        return updatedStudy;
    };

    const handleClone = async (annotationEdits: StudyAnnotationEdits | undefined) => {
        if (
            !storeStudy.id ||
            !studysetId ||
            !studyset ||
            !studyset.studies ||
            !annotationId ||
            studyset.studies.length === 0
        ) {
            return;
        }
        setIsCloning(true);
        try {
            const currentStudyBeingEditedIndex = studyset.studies.findIndex((study) => study === storeStudy.id);
            if (currentStudyBeingEditedIndex < 0) throw new Error('study not found in studyset');

            // Build a mapping of study ID -> stub UUID so we can preserve curation linkage when swapping versions.
            const studyToStub = new Map<string, string>();
            (studyset.studyset_studies || []).forEach((assoc) => {
                if (assoc?.id && assoc?.curation_stub_uuid) {
                    studyToStub.set(assoc.id, assoc.curation_stub_uuid);
                }
            });

            // 1. clone the study
            const clonedStudy = (await createStudy({ sourceId: storeStudy.id, data: getNewScrubbedStudyFromStore() }))
                .data;
            const clonedStudyId = clonedStudy.id;
            if (!clonedStudyId) throw new Error('study not cloned correctly');

            const updatedClone = (await API.NeurostoreServices.StudiesService.studiesIdGet(clonedStudyId, true)).data;

            // 2. update the studyset containing the study with our new clone
            const updatedStudies = [...(studyset.studies ?? [])];
            updatedStudies[currentStudyBeingEditedIndex] = clonedStudyId;

            // Preserve the stub UUID from the original study on the new version, and keep other stubs intact.
            const stubForOriginal = studyToStub.get(storeStudy.id);
            if (stubForOriginal) {
                studyToStub.delete(storeStudy.id);
                studyToStub.set(clonedStudyId, stubForOriginal);
            }

            const studiesPayload = updatedStudies.map((id) => {
                const stub = studyToStub.get(id);
                return { id, curation_stub_uuid: stub };
            });

            await updateStudyset({
                studysetId: studysetId,
                studyset: {
                    studies: studiesPayload,
                },
            });
            queryClient.invalidateQueries({ queryKey: studysetQueries.all() });

            // 3. update the project as this keeps track of completion status of studies
            replaceStudyWithNewClonedStudy(storeStudy.id, clonedStudyId);
            updateExtractionTableStateStudySwapInStorage(projectId, storeStudy.id, clonedStudyId);

            // 4. as this is a completely new study, that we've just created, the annotations are cleared.
            // We need to update the annotations with our latest changes, and associate newly created analyses with their corresponding analysis changes.
            //      - we do this based on the analysis names since the IDs are reinitialized by neurostore
            if (annotationEditsHaveChanges(annotationEdits)) {
                const analysisIdToName = new Map(analyses.map((analysis) => [analysis.id, analysis.name]));
                const cloneAnalysisNameToId = new Map(
                    ((updatedClone.analyses || []) as AnalysisReturn[]).map((analysis) => [analysis.name, analysis.id])
                );
                await updateAnnotationInDB({
                    ...annotationEdits,
                    rows: annotationEdits.rows.map((row) => {
                        if (row.study !== storeStudy.id) return row;
                        const clonedAnalysisId = cloneAnalysisNameToId.get(analysisIdToName.get(row.analysis));
                        if (!clonedAnalysisId) return row;
                        return { ...row, analysis: clonedAnalysisId, study: clonedStudyId };
                    }),
                });
            }

            setAnnotationHasEdits(false);
            unsetUnloadHandler('study');

            // the cloned study's page builds its annotations table from this query, so it must not start from stale data
            await queryClient.refetchQueries({ queryKey: annotationQueries.byId(annotationId).queryKey });

            navigate(`/projects/${projectId}/extraction/studies/${clonedStudyId}/edit`);
            enqueueSnackbar('Made a new a copy and saved succesfully', {
                variant: 'success',
            });

            return clonedStudyId;
        } catch (e) {
            enqueueSnackbar('We encountered an error saving your study. Please contact the neurosynth-compose team', {
                variant: 'error',
            });
            console.error(e);
        } finally {
            setIsCloning(false);
        }
    };

    const handleSave = async () => {
        const { isError: hasDuplicateError, errorMessage: hasDuplicateErrorMessage } =
            hasDuplicateStudyAnalysisNames(analyses);
        if (hasDuplicateError) {
            enqueueSnackbar(hasDuplicateErrorMessage, { variant: 'warning' });
            return;
        }

        const { isError: emptyPointError, errorMessage: emptyPointErrorMessage } = hasEmptyStudyPoints(analyses);
        if (emptyPointError) {
            enqueueSnackbar(emptyPointErrorMessage, { variant: 'warning' });
            return;
        }

        // the study annotations table holds the draft annotation until now
        const annotationEdits = studyAnnotationsTableRef.current?.getAnnotationEdits();

        const currentUserOwnsThisStudy = (studyOwnerUser || null) === (user?.sub || undefined);
        if (currentUserOwnsThisStudy) {
            await handleUpdateDB(annotationEdits);
        } else {
            if (studyHasBeenEdited) {
                return await handleClone(annotationEdits);
            } else {
                await handleUpdateDB(annotationEdits);
            }
        }
    };

    const isLoading =
        updateStudyIsLoading || updateAnnotationIsLoading || updateAnnotationAnalysesIsLoading || isCloning;
    const hasEdits = studyHasBeenEdited || annotationHasEdits;

    return { isLoading, hasEdits, handleSave };
};

export default useSaveStudy;
