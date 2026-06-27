import { AnnotationReturnOneOf, NoteCollectionReturn } from 'neurostore-typescript-sdk';

export type AnnotationReturnOneOfWithNoteCollection = Omit<AnnotationReturnOneOf, 'notes'> & {
    notes?: Array<NoteCollectionReturn>;
};
