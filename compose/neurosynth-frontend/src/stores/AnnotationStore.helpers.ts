import { NoteKeyType } from 'components/HotTables/HotTables.types';
import { EPropertyType } from 'components/EditMetadata';
import { AnnotationNoteType } from 'stores/AnnotationStore.types';

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
