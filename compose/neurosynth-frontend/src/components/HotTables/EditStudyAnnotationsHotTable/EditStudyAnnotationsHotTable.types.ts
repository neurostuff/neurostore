import { ColumnSettings } from 'handsontable/settings';
import { NoteCollectionReturn } from 'neurostore-typescript-sdk';

export interface EditStudyAnnotationsNoteCollectionReturn extends NoteCollectionReturn {
    analysisDescription?: string;
}

export interface IEditStudyAnnotationsDataRef {
    columns: ColumnSettings[];
    colHeaders: string[];
    colWidths: number[];
}
