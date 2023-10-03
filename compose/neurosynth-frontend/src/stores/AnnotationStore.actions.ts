import { useAnnotationStore } from './AnnotationStore';

export const useInitAnnotationStore = () =>
    useAnnotationStore((state) => state.initAnnotationStore);

export const useSetAnnotationIsEdited = () =>
    useAnnotationStore((state) => state.setAnnotationIsEdited);

export const useClearAnnotationStore = () =>
    useAnnotationStore((state) => state.clearAnnotationStore);

export const useAnnotationNoteKeys = () =>
    useAnnotationStore((state) => state.annotation.note_keys);

export const useUpdateAnnotationNotes = () => useAnnotationStore((state) => state.updateNotes);

export const useUpdateAnnotationInDB = () =>
    useAnnotationStore((state) => state.updateAnnotationInDB);

export const useCreateAnnotationNote = () =>
    useAnnotationStore((state) => state.createAnnotationNote);
