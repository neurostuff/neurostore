export interface IDisplayValuesTableRowArgs {
    uniqueKey: string | number;
    columnValues: {
        value: string | boolean | number | undefined | null;
        colorByType?: boolean;
        center?: boolean;
        bold?: boolean;
        shouldHighlightNoData?: boolean;
        isAction?: boolean;
        width?: number;
        noWrap?: boolean;
        expandable?: boolean;
        actionStyling?:
            | 'inherit'
            | 'error'
            | 'primary'
            | 'secondary'
            | 'success'
            | 'info'
            | 'warning';
    }[];
}

/**
 * these properties should not be present when setting the rowData in external components.
 * They should be set once in the IDisplayValuesTableModel and then propagated to the rows
 */
export interface IDisplayValuesTableRowModel extends IDisplayValuesTableRowArgs {
    canSelectRow: boolean;
    onSelectRow: (selected: string | number) => void;
    onSelectAction: (selectedId: string) => void;
}

export interface IDisplayValuesTableModel {
    isLoading?: boolean;
    columnHeaders: {
        value: string;
        center?: boolean;
        bold?: boolean;
    }[];
    onValueSelected?: (selected: string | number) => void;
    onActionSelected?: (selectedId: string) => void;
    selectable?: boolean;
    paper?: boolean;
    tableHeadRowColor?: string;
    tableHeadRowTextContrastColor?: string;
    rowData: IDisplayValuesTableRowArgs[];
}
