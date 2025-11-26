import { useAnnotationStore } from './AnnotationStore';

export const useInitAnnotationStore = () => useAnnotationStore((state) => state.initAnnotationStore);

export const useSetAnnotationIsEdited = () => useAnnotationStore((state) => state.setAnnotationIsEdited);

export const useClearAnnotationStore = () => useAnnotationStore((state) => state.clearAnnotationStore);

export const useAnnotationNoteKeys = () => useAnnotationStore((state) => state.annotation.note_keys);

export const useUpdateAnnotationNotes = () => useAnnotationStore((state) => state.updateNotes);

export const useCreateAnnotationColumn = () => useAnnotationStore((state) => state.createAnnotationColumn);

export const useRemoveAnnotationColumn = () => useAnnotationStore((state) => state.removeAnnotationColumn);

export const useUpdateAnnotationInDB = () => useAnnotationStore((state) => state.updateAnnotationInDB);

export const useCreateAnnotationNote = () => useAnnotationStore((state) => state.createAnnotationNote);

export const useDeleteAnnotationNote = () => useAnnotationStore((state) => state.deleteAnnotationNote);
export const useUpdateAnnotationNoteName = () => useAnnotationStore((state) => state.updateAnnotationNoteName);
