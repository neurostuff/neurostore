import { CellChange } from 'handsontable/common';
import { EPropertyType } from '../EditMetadata';

export interface INeurosynthCell {
    value: string;
    type: EPropertyType;
}

export interface INeurosynthSpreadsheetData {
    rowHeaderValues: string[];
    columnHeaderValues: INeurosynthCell[];
    data: ISpreadsheetDataRow[];
    onColumnDelete: (colIndexDeleted: number, colDeleted: string) => void;
    onCellUpdates: (changes: CellChange[]) => void;
}

export interface ISpreadsheetDataRow {
    [key: string]: string | boolean | number;
    _isStudyTitle: boolean;
    _studyTitle: string;
}
