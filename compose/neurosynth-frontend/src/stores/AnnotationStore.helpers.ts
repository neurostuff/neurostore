import { NoteKeyType } from 'components/HotTables/HotTables.types';
import { EPropertyType } from 'components/EditMetadata/EditMetadata.types';
import { AnnotationNoteType, IStoreNoteCollectionReturn } from 'stores/AnnotationStore.types';
import { NoteCollectionRequest } from 'neurostore-typescript-sdk';

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
    return x;
};

export const storeNotesToDBNotes = (
    notes: IStoreNoteCollectionReturn[]
): NoteCollectionRequest[] => {
    return notes.map((annotationNote) => ({
        analysis: annotationNote.analysis,
        study: annotationNote.study,
        note: annotationNote.note,
    }));
};

export const updateNoteNameHelper = (
    notes: IStoreNoteCollectionReturn[],
    update: Partial<IStoreNoteCollectionReturn>
): IStoreNoteCollectionReturn[] => {
    const updatedNotes = [...notes];
    const foundNoteIndex = updatedNotes.findIndex((note) => note.analysis === update.analysis);
    if (foundNoteIndex < 0) return updatedNotes;

    updatedNotes[foundNoteIndex] = {
        ...updatedNotes[foundNoteIndex],
        analysis_name: update.analysis_name,
    };
    return updatedNotes;
};
