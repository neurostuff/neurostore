import { AnnotationNoteType } from 'components/HotTables/HotTables.types';
import { ColumnSettings } from 'handsontable/settings';
import { NoteCollectionReturn } from 'neurostore-typescript-sdk';

export interface EditStudyAnnotationsNoteCollectionReturn extends NoteCollectionReturn {
    analysis: string;
    study: string;
    note: AnnotationNoteType;
    analysisDescription?: string;
    /** not a column. New analyses have a temporary id until the study is saved */
    isNew?: boolean;
}

export interface IEditStudyAnnotationsDataRef {
    columns: ColumnSettings[];
    colHeaders: string[];
    colWidths: number[];
}
