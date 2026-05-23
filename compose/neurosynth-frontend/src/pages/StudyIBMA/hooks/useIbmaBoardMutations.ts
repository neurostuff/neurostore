import { getDefaultForNoteKey, noteKeyArrToObj, noteKeyObjToArr } from 'components/HotTables/HotTables.utils';
import type { NoteKeyType } from 'components/HotTables/HotTables.types';
import analysisQueries from 'hooks/analyses/analysisQueries';
import annotationQueries from 'hooks/annotations/annotationQueries';
import type { AnnotationReturnOneOfWithNoteCollection } from 'hooks/annotations/annotationQueries.types';
import {
    useCreateAnalysis,
    useDeleteAnalysis,
    useUpdateAnalysis,
    useUpdateAnnotationByAnnotationAndAnalysisIds,
    useUpdateAnnotationById,
    useUpdateImage,
} from 'hooks';
import type { ImageRequest, NoteCollectionRequest } from 'neurostore-typescript-sdk';
import type { NewAnnotationColumnPayload } from 'pages/StudyIBMA/components/NewAnnotationColumnDialog';
import useEnsureWritableStudy from 'pages/StudyIBMA/hooks/useEnsureWritableStudy';
import { useCallback } from 'react';
import { useQueryClient } from 'react-query';

export type UseIbmaBoardMutationsArgs = {
    studyId: string | undefined;
    annotationId: string | undefined;
    annotation: AnnotationReturnOneOfWithNoteCollection | undefined;
};

const useIbmaBoardMutations = ({ studyId, annotationId, annotation }: UseIbmaBoardMutationsArgs) => {
    const queryClient = useQueryClient();
    const { ensureWritableStudy, isLoading: ensureWritableStudyIsLoading } = useEnsureWritableStudy();
    const createAnalysisMutation = useCreateAnalysis();
    const updateAnalysisMutation = useUpdateAnalysis();
    const deleteAnalysisMutation = useDeleteAnalysis();
    const updateAnnotationMutation = useUpdateAnnotationById(annotationId);
    const updateAnnotationCellMutation = useUpdateAnnotationByAnnotationAndAnalysisIds(annotationId);
    const updateImageMutation = useUpdateImage();

    const invalidateBoard = useCallback(
        async (writableStudyId: string | undefined) => {
            if (!writableStudyId) return;
            await Promise.all([
                queryClient.invalidateQueries(analysisQueries.analyses.byStudyId(writableStudyId).queryKey),
                queryClient.invalidateQueries(analysisQueries.images.uncategorizedByStudyId(writableStudyId).queryKey),
                queryClient.invalidateQueries(annotationQueries.byId(annotationId).queryKey),
            ]);
        },
        [annotationId, queryClient]
    );

    const createAnalysis = useCallback(async () => {
        if (!studyId || !annotationId) return;

        const writableStudy = await ensureWritableStudy();
        if (!writableStudy) return;

        const createRes = await createAnalysisMutation.mutateAsync({
            study: writableStudy.studyId,
            name: '',
            description: '',
        });
        if (!createRes.data?.id) return;

        // Neurostore creates annotation notes in the same request as analysesPost (update_annotations).
        await invalidateBoard(writableStudy.studyId);
    }, [annotationId, createAnalysisMutation, ensureWritableStudy, invalidateBoard, studyId]);

    const updateAnalysis = useCallback(
        async (args: { analysisId: string; name: string; description: string }) => {
            const writableStudy = await ensureWritableStudy();
            if (!writableStudy) return;

            const targetAnalysisId = writableStudy.idMap.oldAnalysisIdsToNewIdsMap[args.analysisId];

            await updateAnalysisMutation.mutateAsync({
                analysisId: targetAnalysisId,
                analysis: { name: args.name, description: args.description },
            });
            await invalidateBoard(writableStudy.studyId);
        },
        [ensureWritableStudy, invalidateBoard, updateAnalysisMutation]
    );

    const deleteAnalysis = useCallback(
        async (analysisId: string) => {
            const writableStudy = await ensureWritableStudy();
            if (!writableStudy) return;

            const targetAnalysisId = writableStudy.idMap.oldAnalysisIdsToNewIdsMap[analysisId];

            await deleteAnalysisMutation.mutateAsync(targetAnalysisId);
            await invalidateBoard(writableStudy.studyId);
        },
        [deleteAnalysisMutation, ensureWritableStudy, invalidateBoard]
    );

    const addAnnotationColumn = useCallback(
        async (payload: NewAnnotationColumnPayload) => {
            if (!annotationId) return;

            const currentKeys = noteKeyObjToArr(annotation?.note_keys);
            const resolvedDefault = payload.default ?? getDefaultForNoteKey(payload.key, payload.type);
            const updatedKeys: NoteKeyType[] = [
                ...currentKeys,
                {
                    key: payload.key,
                    type: payload.type,
                    default: resolvedDefault,
                    order: currentKeys.length,
                },
            ];

            const updatedNotes = (annotation?.notes ?? []).map((note) => ({
                analysis: note.analysis,
                study: note.study,
                note: {
                    ...(note.note as Record<string, string | boolean | number | null>),
                    [payload.key]: resolvedDefault,
                },
            }));

            await updateAnnotationMutation.mutateAsync({
                argAnnotationId: annotationId,
                annotation: {
                    note_keys: noteKeyArrToObj(updatedKeys),
                    notes: updatedNotes,
                },
            });
            await invalidateBoard(studyId);
        },
        [annotation?.note_keys, annotation?.notes, annotationId, invalidateBoard, studyId, updateAnnotationMutation]
    );

    const removeAnnotationColumn = useCallback(
        async (columnKey: string) => {
            if (!annotationId) return;

            const currentKeys = noteKeyObjToArr(annotation?.note_keys);
            const updatedKeys = currentKeys
                .filter((k) => k.key !== columnKey)
                .map((key, index) => ({ ...key, order: index }));

            const updatedNotes = (annotation?.notes ?? []).map((note) => {
                const typedNote = { ...(note.note as Record<string, string | boolean | number | null>) };
                delete typedNote[columnKey];
                return {
                    analysis: note.analysis,
                    study: note.study,
                    note: typedNote,
                };
            });

            await updateAnnotationMutation.mutateAsync({
                argAnnotationId: annotationId,
                annotation: {
                    note_keys: noteKeyArrToObj(updatedKeys),
                    notes: updatedNotes,
                },
            });
            await invalidateBoard(studyId);
        },
        [annotation?.note_keys, annotation?.notes, annotationId, invalidateBoard, studyId, updateAnnotationMutation]
    );

    const updateAnnotationCell = useCallback(
        async (args: { analysisId: string; columnKey: string; value: string | boolean | number | null }) => {
            if (!annotationId) return;

            const existingNote = (annotation?.notes ?? []).find((n) => n.analysis === args.analysisId);
            if (!existingNote) return;

            const payload: NoteCollectionRequest = {
                id: `${annotationId}_${args.analysisId}`,
                note: {
                    ...(existingNote.note as Record<string, string | boolean | number | null>),
                    [args.columnKey]: args.value,
                },
            };
            await updateAnnotationCellMutation.mutateAsync([payload]);
            await invalidateBoard(studyId);
        },
        [annotation?.notes, annotationId, invalidateBoard, studyId, updateAnnotationCellMutation]
    );

    const updateImage = useCallback(
        async (imageId: string, image: ImageRequest) => {
            const writableStudy = await ensureWritableStudy();
            if (!writableStudy) return;

            const targetImageId = writableStudy.idMap.oldImageIdToNewIdMap[imageId];
            const targetImage: ImageRequest = {
                ...image,
                id: targetImageId,
            };
            if (typeof image.analysis === 'string') {
                targetImage.analysis = writableStudy.idMap.oldAnalysisIdsToNewIdsMap[image.analysis];
            } else {
                targetImage.analysis = null;
            }

            await updateImageMutation.mutateAsync({
                imageId: targetImageId,
                image: targetImage,
            });
            await invalidateBoard(writableStudy.studyId);
        },
        [ensureWritableStudy, invalidateBoard, updateImageMutation]
    );

    const isPending =
        ensureWritableStudyIsLoading ||
        createAnalysisMutation.isLoading ||
        updateAnalysisMutation.isLoading ||
        deleteAnalysisMutation.isLoading ||
        updateAnnotationMutation.isLoading ||
        updateAnnotationCellMutation.isLoading ||
        updateImageMutation.isLoading;

    return {
        createAnalysis,
        updateAnalysis,
        deleteAnalysis,
        addAnnotationColumn,
        removeAnnotationColumn,
        updateAnnotationCell,
        updateImage,
        isPending,
    };
};

export default useIbmaBoardMutations;
