import { EPropertyType } from 'components/EditMetadata/EditMetadata.types';

export interface NoteKeyType {
    key: string;
    type: EPropertyType;
}

export type AnnotationNoteValue = string | number | boolean | null;
