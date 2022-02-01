import { CellChange } from 'handsontable/common';
import { EPropertyType } from '../EditMetadata';

export interface INeurosynthCell {
    value: string;
    type: EPropertyType;
}

export interface INeurosynthSpreadsheetData {
    rowHeaderValues: string[];
    columnHeaderValues: INeurosynthCell[];
    data: {
        [key: string]: string | number | boolean | null;
    }[];
    onColumnDelete: (colIndexDeleted: number, colDeleted: string) => void;
    onCellUpdates: (changes: CellChange[]) => void;
}
