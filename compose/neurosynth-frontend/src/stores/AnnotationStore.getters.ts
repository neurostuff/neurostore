import { useAnnotationStore } from 'stores/AnnotationStore';

export const useAnnotationName = () => useAnnotationStore((state) => state.annotation.name);
export const useAnnotationNotes = () => useAnnotationStore((state) => state.annotation.notes);
export const useGetAnnotationIsLoading = () =>
    useAnnotationStore((state) => state.storeMetadata.getAnnotationIsLoading);
export const useUpdateAnnotationIsLoading = () =>
    useAnnotationStore((state) => state.storeMetadata.updateAnnotationIsLoading);
export const useAnnotationIsEdited = () => useAnnotationStore((state) => state.storeMetadata.annotationIsEdited);
export const useAnnotationIsError = () => useAnnotationStore((state) => state.storeMetadata.isError);
export const useAnnotationId = () => useAnnotationStore((state) => state.annotation.id);
