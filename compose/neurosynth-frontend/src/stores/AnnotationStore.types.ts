import { NoteKeyType } from 'components/HotTables/HotTables.types';
import { AnnotationReturnOneOf, NoteCollectionReturn } from 'neurostore-typescript-sdk';

export type AnnotationStoreMetadata = {
    annotationIsEdited: boolean;
    getAnnotationIsLoading: boolean;
    updateAnnotationIsLoading: boolean;
    isError: boolean; // for http errors that occur
};

export interface IStoreNoteCollectionReturn extends NoteCollectionReturn {
    isNew?: boolean;
    isEdited?: boolean;
}

export interface IStoreAnnotation extends Omit<AnnotationReturnOneOf, 'notes' | 'note_keys'> {
    notes: IStoreNoteCollectionReturn[] | undefined;
    note_keys: NoteKeyType[] | undefined;
}

export type AnnotationStoreActions = {
    initAnnotationStore: (annotationId?: string) => void;
    setAnnotationIsEdited: (isEdited: boolean) => void;
    clearAnnotationStore: () => void;
    updateNotes: (updatedNotes: Array<NoteCollectionReturn>) => void;
    createAnnotationColumn: (noteKey: Omit<NoteKeyType, 'order'>) => void;
    updateAnnotationInDB: () => Promise<void>;
    createAnnotationNote: (analysisId: string, studyId: string, analysisName: string) => void;
    deleteAnnotationNote: (analysisId: string) => void;
    removeAnnotationColumn: (noteKey: string) => void;
    updateAnnotationNoteDetails: (note: Partial<IStoreNoteCollectionReturn>) => void;
};

export type AnnotationNoteType = {
    [key: string]: string | boolean | number | null;
};
