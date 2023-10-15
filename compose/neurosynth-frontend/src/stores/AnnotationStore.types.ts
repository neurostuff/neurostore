import { NoteKeyType } from 'components/HotTables/helpers/utils';
import { AnnotationReturnOneOf1, NoteCollectionReturn } from 'neurostore-typescript-sdk';

export type AnnotationStoreMetadata = {
    annotationIsEdited: boolean;
    annotationIsLoading: boolean;
    isError: boolean; // for http errors that occur
};

export type AnnotationNoteValue = string | number | boolean | null;

export interface IStoreAnnotation extends Omit<AnnotationReturnOneOf1, 'notes' | 'note_keys'> {
    notes: NoteCollectionReturn[];
    note_keys: NoteKeyType[];
    isNew: boolean;
}

export type AnnotationStoreActions = {
    initAnnotationStore: (annotationId?: string) => void;
    setAnnotationIsEdited: (isEdited: boolean) => void;
    clearAnnotationStore: () => void;
    updateNotes: (updatedNotes: Array<NoteCollectionReturn>) => void;
    updateAnnotationInDB: () => Promise<void>;
    createAnnotationNote: (analysisId: string, studyId: string, analysisName: string) => void;
};

export type AnnotationNoteType = {
    [key: string]: string | boolean | number | null;
};
