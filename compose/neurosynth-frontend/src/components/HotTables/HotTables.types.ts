import { EPropertyType } from 'components/EditMetadata';

export interface NoteKeyType {
    key: string;
    type: EPropertyType;
}

export type AnnotationNoteValue = string | number | boolean | null;
