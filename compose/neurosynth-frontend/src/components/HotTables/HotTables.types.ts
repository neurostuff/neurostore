import { EPropertyType } from 'components/EditMetadata/EditMetadata.types';

export interface NoteKeyType {
    key: string;
    type: EPropertyType;
    order: number;
<<<<<<< HEAD
    isNew?: boolean;
=======
    default?: AnnotationNoteValue;
>>>>>>> 65104f84 (merge code)
}

export type AnnotationNoteValue = string | number | boolean | null;
