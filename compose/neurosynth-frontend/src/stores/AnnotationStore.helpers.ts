import { NoteKeyType } from 'components/EditAnnotations/helpers/utils';
import { EPropertyType } from 'components/EditMetadata';

export const noteKeyObjToArr = (noteKeys?: object | null): NoteKeyType[] => {
    if (!noteKeys) return [];
    const noteKeyTypes = noteKeys as { [key: string]: EPropertyType };
    const arr = Object.entries(noteKeyTypes).map(([key, type]) => ({
        key,
        type,
    }));
    return arr;
};
