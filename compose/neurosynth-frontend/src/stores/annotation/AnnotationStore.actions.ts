import { useEffect } from 'react';
import { useGetAnnotationById, useUpdateAnnotationByAnnotationAndAnalysisId, useUpdateAnnotationById } from 'hooks';
import { useAnnotationStore } from 'stores/annotation/AnnotationStore';
import { useProjectExtractionAnnotationId } from 'stores/projects/ProjectStore';
import { useAnnotationId } from './AnnotationStore.getters';

export const useInitAnnotationStore = () => useAnnotationStore((state) => state.initAnnotationStore);

export const useUpdateAnnotationMetadata = () => useAnnotationStore((state) => state.updateAnnotationMetadata);

export const useSetAnnotationIsEdited = () => useAnnotationStore((state) => state.setAnnotationIsEdited);

export const useClearAnnotationStore = () => useAnnotationStore((state) => state.clearAnnotationStore);

export const useAnnotationNoteKeys = () => useAnnotationStore((state) => state.annotation.note_keys);

export const useUpdateAnnotationNotes = () => useAnnotationStore((state) => state.updateNotes);

export const useCreateAnnotationColumn = () => useAnnotationStore((state) => state.createAnnotationColumn);

export const useRemoveAnnotationColumn = () => useAnnotationStore((state) => state.removeAnnotationColumn);

export const useUpdateDBWithAnnotationFromStore = () => useAnnotationStore((state) => state.updateAnnotationInDB);

export const useCreateAnnotationNote = () => useAnnotationStore((state) => state.createAnnotationNote);

export const useDeleteAnnotationNote = () => useAnnotationStore((state) => state.deleteAnnotationNote);

export const useUpdateAnnotationNoteDetails = () => useAnnotationStore((state) => state.updateAnnotationNoteDetails);

export const useInitAnnotationStoreIfRequired = () => {
    const clearAnnotationStore = useClearAnnotationStore();
    const initAnnotationStore = useInitAnnotationStore();
    const updateAnnotationMetadata = useUpdateAnnotationMetadata();
    const storeAnnotationId = useAnnotationId();
    const extractionAnnotationId = useProjectExtractionAnnotationId();

    const {
        data,
        isLoading: getAnnotationIsLoading,
        isError: getAnnotationIsError,
    } = useGetAnnotationById(extractionAnnotationId ?? undefined);

    const {
        mutate: updateAnnotation,
        isLoading: updateAnnotationIsLoading,
        isError: updateAnnotationIsError,
    } = useUpdateAnnotationById(extractionAnnotationId ?? undefined);
    const {
        mutate: updateAnnotationAnalyses,
        isLoading: updateAnnotationAnalysesIsLoading,
        isError: updateAnnotationAnalysesIsError,
    } = useUpdateAnnotationByAnnotationAndAnalysisId(extractionAnnotationId ?? undefined);

    useEffect(() => {
        const dataMatchesRequestedId = !!data && (!data.id || data.id === extractionAnnotationId);

        if (extractionAnnotationId && extractionAnnotationId !== storeAnnotationId && dataMatchesRequestedId) {
            clearAnnotationStore();
            initAnnotationStore(data);
        }

        const isLoading = updateAnnotationIsLoading || updateAnnotationAnalysesIsLoading;
        const isError = getAnnotationIsError || updateAnnotationIsError || updateAnnotationAnalysesIsError;

        updateAnnotationMetadata({
            getAnnotationIsLoading: getAnnotationIsLoading,
            updateAnnotationIsLoading: isLoading,
            isError: isError,
            updateAnnotations: updateAnnotation,
            updateAnnotationAnalyses: updateAnnotationAnalyses,
        });
    }, [
        clearAnnotationStore,
        data,
        extractionAnnotationId,
        getAnnotationIsError,
        getAnnotationIsLoading,
        initAnnotationStore,
        storeAnnotationId,
        updateAnnotationIsError,
        updateAnnotationIsLoading,
        updateAnnotationAnalysesIsError,
        updateAnnotationAnalysesIsLoading,
        updateAnnotationMetadata,
    ]);
};
