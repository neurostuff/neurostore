import { NoteKeyType } from 'components/HotTables/helpers/utils';
import { EPropertyType } from 'components/EditMetadata';
import { AnnotationNoteType } from 'stores/AnnotationStore.types';
import { NoteCollectionReturn } from 'neurostore-typescript-sdk';

export const noteKeyObjToArr = (noteKeys?: object | null): NoteKeyType[] => {
    if (!noteKeys) return [];
    const noteKeyTypes = noteKeys as { [key: string]: EPropertyType };
    const arr = Object.entries(noteKeyTypes).map(([key, type]) => ({
        key,
        type,
    }));
    return arr;
};

export const noteKeyArrToDefaultNoteKeyObj = (noteKeys: NoteKeyType[]): AnnotationNoteType => {
    const x = noteKeys.reduce((acc, curr) => {
        acc[curr.key] = null;
        return acc;
    }, {} as AnnotationNoteType);
    console.log(x);
    return x;
};

export const updateNotesHelper = (
    notesState: NoteCollectionReturn[] | undefined,
    updatedNotes: NoteCollectionReturn[]
) => {
    if (!notesState) return notesState;
    const update = [...notesState];
    updatedNotes.forEach((updatedNote) => {
        const updatedNoteFoundIndex = update.findIndex((x) => x.analysis === updatedNote.analysis);
        if (updatedNoteFoundIndex !== undefined) {
            update[updatedNoteFoundIndex] = {
                ...update[updatedNoteFoundIndex],
                ...updatedNote,
            };
        }
    });
    return update;
};
