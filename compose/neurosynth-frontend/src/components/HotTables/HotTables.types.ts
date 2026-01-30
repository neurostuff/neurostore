import { EPropertyType } from 'components/EditMetadata/EditMetadata.types';

export interface NoteKeyType {
    key: string;
    type: EPropertyType;
    order: number;
    isNew?: boolean;
    default?: AnnotationNoteValue;
}

export type AnnotationNoteValue = string | number | boolean | null;
