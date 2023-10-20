import { NoteKeyType } from 'components/HotTables/HotTables.types';
import { AnnotationReturnOneOf1, NoteCollectionReturn } from 'neurostore-typescript-sdk';

export type AnnotationStoreMetadata = {
    annotationIsEdited: boolean;
    annotationIsLoading: boolean;
    isError: boolean; // for http errors that occur
};

export interface IStoreNoteCollectionReturn extends NoteCollectionReturn {
    isNew?: boolean;
}

export interface IStoreAnnotation extends Omit<AnnotationReturnOneOf1, 'notes' | 'note_keys'> {
    notes: IStoreNoteCollectionReturn[] | undefined;
    note_keys: NoteKeyType[] | undefined;
}

export type AnnotationStoreActions = {
    initAnnotationStore: (annotationId?: string) => void;
    setAnnotationIsEdited: (isEdited: boolean) => void;
    clearAnnotationStore: () => void;
    updateNotes: (updatedNotes: Array<NoteCollectionReturn>) => void;
    updateAnnotationInDB: () => Promise<void>;
    createAnnotationNote: (analysisId: string, studyId: string, analysisName: string) => void;
    deleteAnnotationNote: (analysisId: string) => void;
};

export type AnnotationNoteType = {
    [key: string]: string | boolean | number | null;
};
