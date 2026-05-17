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
import { useCallback } from 'react';
import { useQueryClient } from 'react-query';

export type UseIbmaBoardMutationsArgs = {
    studyId: string | undefined;
    annotationId: string | undefined;
    annotation: AnnotationReturnOneOfWithNoteCollection | undefined;
};

const useIbmaBoardMutations = ({ studyId, annotationId, annotation }: UseIbmaBoardMutationsArgs) => {
    const queryClient = useQueryClient();
    const createAnalysisMutation = useCreateAnalysis();
    const updateAnalysisMutation = useUpdateAnalysis();
    const deleteAnalysisMutation = useDeleteAnalysis();
    const updateAnnotationMutation = useUpdateAnnotationById(annotationId);
    const updateAnnotationCellMutation = useUpdateAnnotationByAnnotationAndAnalysisIds(annotationId);
    const updateImageMutation = useUpdateImage();

    const invalidateBoard = useCallback(async () => {
        await Promise.all([
            queryClient.invalidateQueries(analysisQueries.analyses.byStudyId(studyId).queryKey),
            queryClient.invalidateQueries(annotationQueries.byId(annotationId).queryKey),
        ]);
    }, [annotationId, queryClient, studyId]);

    const createAnalysis = useCallback(async () => {
        if (!studyId || !annotationId) return;

        const createRes = await createAnalysisMutation.mutateAsync({
            study: studyId,
            name: '',
            description: '',
        });
        if (!createRes.data?.id) return;

        // Neurostore creates annotation notes in the same request as analysesPost (update_annotations).
        await invalidateBoard();
    }, [annotationId, createAnalysisMutation, invalidateBoard, studyId]);

    const updateAnalysis = useCallback(
        async (args: { analysisId: string; name: string; description: string }) => {
            await updateAnalysisMutation.mutateAsync({
                analysisId: args.analysisId,
                analysis: { name: args.name, description: args.description },
            });
            await invalidateBoard();
        },
        [invalidateBoard, updateAnalysisMutation]
    );

    const deleteAnalysis = useCallback(
        async (analysisId: string) => {
            await deleteAnalysisMutation.mutateAsync(analysisId);
            await invalidateBoard();
        },
        [deleteAnalysisMutation, invalidateBoard]
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
            await invalidateBoard();
        },
        [annotation?.note_keys, annotation?.notes, annotationId, invalidateBoard, updateAnnotationMutation]
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
            await invalidateBoard();
        },
        [annotation?.note_keys, annotation?.notes, annotationId, invalidateBoard, updateAnnotationMutation]
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
            await invalidateBoard();
        },
        [annotation?.notes, annotationId, invalidateBoard, updateAnnotationCellMutation]
    );

    const updateImage = useCallback(
        async (imageId: string, image: ImageRequest) => {
            await updateImageMutation.mutateAsync({
                imageId,
                image: { ...image, id: imageId },
            });
            await invalidateBoard();
        },
        [invalidateBoard, updateImageMutation]
    );

    const isPending =
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
