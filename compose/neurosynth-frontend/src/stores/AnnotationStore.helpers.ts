import { NoteKeyType } from 'components/HotTables/HotTables.types';
import { EPropertyType } from 'components/EditMetadata/EditMetadata.types';
import { AnnotationNoteType, IStoreNoteCollectionReturn } from 'stores/AnnotationStore.types';
import { NoteCollectionRequest } from 'neurostore-typescript-sdk';

export const noteKeyObjToArr = (noteKeys?: object | null): NoteKeyType[] => {
    if (!noteKeys) return [];
    const noteKeyTypes = noteKeys as { [key: string]: { type: EPropertyType; order?: number } };
    const arr = Object.entries(noteKeyTypes)
        .map(([key, descriptor]) => {
            if (!descriptor?.type) throw new Error('Invalid note_keys descriptor: missing type');
            return {
                key,
                type: descriptor.type,
                order: descriptor.order ?? 0,
            };
        })
        .sort((a, b) => a.order - b.order || a.key.localeCompare(b.key))
        .map((noteKey, index) => ({ ...noteKey, order: index }));
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
