export interface IDisplayValuesTableRowModel {
    uniqueKey: string;
    columnValues: {
        value: string | boolean | number | undefined | null;
        colorByType: boolean;
        center: boolean;
        bold: boolean;
    }[];
}

export interface IDisplayValuesTableModel {
    columnHeaders: {
        value: string;
        center: boolean;
        bold: boolean;
    }[];
    rowData: IDisplayValuesTableRowModel[];
}
