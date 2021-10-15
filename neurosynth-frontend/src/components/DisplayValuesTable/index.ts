export interface DisplayValuesTableRowModel {
    uniqueKey: string;
    columnValues: {
        value: string | boolean | number | undefined | null;
        colorByType: boolean;
        bold: boolean;
    }[];
}

export interface DisplayValuesTableModel {
    columnHeaders: string[];
    rowData: DisplayValuesTableRowModel[];
}
