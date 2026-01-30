import { NoteKeyType } from 'components/HotTables/HotTables.types';
import { AnnotationNoteType, IStoreNoteCollectionReturn } from 'stores/AnnotationStore.types';
import { NoteCollectionRequest } from 'neurostore-typescript-sdk';

export const noteKeyArrToDefaultNoteKeyObj = (noteKeys: NoteKeyType[]): AnnotationNoteType => {
    const x = noteKeys.reduce((acc, curr) => {
        const hasDefault = Object.prototype.hasOwnProperty.call(curr, 'default');
        acc[curr.key] = hasDefault ? (curr.default ?? null) : null;
        return acc;
    }, {} as AnnotationNoteType);
    return x;
};

export const storeNotesToDBNotes = (notes: IStoreNoteCollectionReturn[]): NoteCollectionRequest[] => {
    return notes.map((annotationNote) => ({
        analysis: annotationNote.analysis,
        study: annotationNote.study,
        note: annotationNote.note,
    }));
};

export const updateNoteDetailsHelper = (
    notes: IStoreNoteCollectionReturn[],
    update: Partial<IStoreNoteCollectionReturn>
): IStoreNoteCollectionReturn[] => {
    const updatedNotes = [...notes];
    const foundNoteIndex = updatedNotes.findIndex((note) => note.analysis === update.analysis);
    if (foundNoteIndex < 0) return updatedNotes;

    updatedNotes[foundNoteIndex] = {
        ...updatedNotes[foundNoteIndex],
        ...update,
    };
    return updatedNotes;
};
