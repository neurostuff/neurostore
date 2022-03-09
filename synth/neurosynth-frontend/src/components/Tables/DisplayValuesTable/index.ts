export interface IDisplayValuesTableRowArgs {
    uniqueKey: string | number;
    columnValues: {
        value: string | boolean | number | undefined | null;
        colorByType?: boolean;
        center?: boolean;
        bold?: boolean;
        shouldHighlightNoData?: boolean;
    }[];
}

export interface IDisplayValuesTableRowModel extends IDisplayValuesTableRowArgs {
    canSelectRow: boolean;
    onSelectRow: (selected: string | number) => void;
}

export interface IDisplayValuesTableModel {
    columnHeaders: {
        value: string;
        center?: boolean;
        bold?: boolean;
    }[];
    onValueSelected?: (selected: string | number) => void;
    selectable?: boolean;
    paper?: boolean;
    tableHeadRowColor?: string;
    tableHeadRowTextContrastColor?: string;
    rowData: IDisplayValuesTableRowArgs[];
}
