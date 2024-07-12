import { ColumnSettings } from 'handsontable/settings';
import { IStoreNoteCollectionReturn } from 'stores/AnnotationStore.types';

export interface EditStudyAnnotationsNoteCollectionReturn extends IStoreNoteCollectionReturn {
    analysisDescription?: string;
}

export interface IEditStudyAnnotationsDataRef {
    columns: ColumnSettings[];
    colHeaders: string[];
    colWidths: number[];
}
