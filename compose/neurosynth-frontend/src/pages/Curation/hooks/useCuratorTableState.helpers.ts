import {
    AccessorFnColumnDef,
    Cell,
    createColumnHelper,
    DisplayColumnDef,
    FilterFnOption,
    Header,
    Row,
} from '@tanstack/react-table';
import CuratorTableCell from '../components/CurationBoardAIInterfaceCuratorTableCell';
import { CuratorTableHeader } from '../components/CurationBoardAIInterfaceCuratorTableHeader';
import {
    CuratorTableSelectCell,
    CuratorTableSelectHeader,
} from '../components/CurationBoardAIInterfaceCuratorTableSelect';
import {
    CuratorTableSummaryCell,
    CuratorTableSummaryHeader,
} from '../components/CurationBoardAIInterfaceCuratorTableSummary';
import {
    PARTICIPANTS_DEMOGRAPHICS_EXTRACTOR_CURATOR_COLUMNS,
    STUB_CURATOR_COLUMNS,
    TASK_EXTRACTOR_CURATOR_COLUMNS,
} from './useCuratorTableState.consts';
import {
    ICurationBoardAIInterfaceCuratorColumnType,
    ICurationTableColumnType,
    ICurationTableStudy,
} from './useCuratorTableState.types';

const columnHelper = createColumnHelper<ICurationTableStudy>();

export const COMBINED_CURATOR_TABLE_COLUMNS = [
    ...STUB_CURATOR_COLUMNS,
    ...TASK_EXTRACTOR_CURATOR_COLUMNS,
    ...PARTICIPANTS_DEMOGRAPHICS_EXTRACTOR_CURATOR_COLUMNS,
];

// Helper function to flatten ICurationTableColumnType into string[]
export const flattenColumnValues = (
    columnValue: ICurationTableColumnType,
    transformLowerCase: boolean
): Set<string> => {
    const values = new Set<string>();
    if (columnValue === null || columnValue === undefined || columnValue === 'null' || columnValue === 'undefined')
        return values;
    if (typeof columnValue === 'string' || typeof columnValue === 'number' || typeof columnValue === 'boolean') {
        values.add(transformLowerCase ? `${columnValue}`.toLocaleLowerCase() : `${columnValue}`);
    } else {
        columnValue.forEach((val) => {
            if (typeof val === 'string') {
                values.add(transformLowerCase ? val.toLocaleLowerCase() : val);
            } else {
                if (
                    val.value === null ||
                    val.value === undefined ||
                    val.value === 'null' ||
                    val.value === 'undefined' ||
                    val.value === ''
                ) {
                    return;
                }
                if (Array.isArray(val.value)) {
                    val.value.forEach((v) => {
                        if (
                            val.value === null ||
                            val.value === undefined ||
                            val.value === 'null' ||
                            val.value === 'undefined' ||
                            val.value === ''
                        ) {
                            return;
                        }
                        values.add(transformLowerCase ? v.toLocaleLowerCase() : v);
                    });
                } else {
                    values.add(transformLowerCase ? `${val.value}`.toLocaleLowerCase() : `${val.value}`);
                }
            }
        });
    }
    return values;
};

// custom autocomplete filter for more complex nested data objects
const nestedAutocompleteFilter: (
    column: ICurationBoardAIInterfaceCuratorColumnType
) => FilterFnOption<ICurationTableStudy> = (column: ICurationBoardAIInterfaceCuratorColumnType) => {
    return (row: Row<ICurationTableStudy>, colId: string, filter: string[] | undefined) => {
        if (!filter || filter.length === 0) return true;
        if (!column.AIExtractor || !row.original[column.AIExtractor] || !column.customAccessor) return false;

        /**
         * Technically this is overkill because this function should only be used for nested EAIExtractor output (IGenericCustomAccessorReturn)
         * However, just to be safe, we will handle all cases (ICurationTableColumnType)
         */
        const columnValue = column.customAccessor(row.original) as ICurationTableColumnType;
        const flattenedValues = flattenColumnValues(columnValue, true);

        return filter.some((filterValue) => flattenedValues.has(filterValue.toLowerCase()));
    };
};

// custom numeric filter for more complex nested data objects
const nestedNumericFilter: (
    column: ICurationBoardAIInterfaceCuratorColumnType
) => FilterFnOption<ICurationTableStudy> = (column: ICurationBoardAIInterfaceCuratorColumnType) => {
    return (
        row: Row<ICurationTableStudy>,
        colId: string,
        filter: [number | undefined, number | undefined] | undefined
    ) => {
        if (!filter) return true;
        if (!column.AIExtractor || !row.original[column.AIExtractor] || !column.customAccessor) return false;

        /**
         * Technically this is overkill because this function should only be used for nested EAIExtractor output (IGenericCustomAccessorReturn)
         * However, just to be safe, we will handle all cases (ICurationTableColumnType)
         */
        const columnValue = column.customAccessor(row.original) as ICurationTableColumnType;
        const flattenedValues = flattenColumnValues(columnValue, false);

        return flattenedValues.values().some((v) => {
            const toNumeric = parseInt(v);
            if (isNaN(toNumeric)) return false;
            const lowerBound = filter[0];
            const upperBound = filter[1];

            if (!lowerBound && upperBound) {
                return toNumeric <= upperBound;
            } else if (lowerBound && !upperBound) {
                return toNumeric >= lowerBound;
            } else if (lowerBound && upperBound) {
                return toNumeric >= lowerBound && toNumeric <= upperBound;
            } else if (!lowerBound && !upperBound) {
                return true;
            }
        });
    };
};

// custom text filter for more complex nested data objects
const nestedTextFilter: (column: ICurationBoardAIInterfaceCuratorColumnType) => FilterFnOption<ICurationTableStudy> = (
    column: ICurationBoardAIInterfaceCuratorColumnType
) => {
    return (row: Row<ICurationTableStudy>, colId: string, filter: string | undefined) => {
        if (!filter) return true;
        if (!column.AIExtractor || !row.original[column.AIExtractor] || !column.customAccessor) return false;

        /**
         * Technically this is overkill because this function should only be used for nested EAIExtractor output (IGenericCustomAccessorReturn)
         * However, just to be safe, we will handle all cases (ICurationTableColumnType)
         */
        const columnValue = column.customAccessor(row.original) as ICurationTableColumnType;
        const flattenedValues = flattenColumnValues(columnValue, true);

        return flattenedValues.values().some((v) => v.includes(filter.toLocaleLowerCase()));

        // return flattenedValues.values().some((v) => {
        //     const toNumeric = parseInt(v);
        //     if (isNaN(toNumeric)) return false;
        //     const lowerBound = filter[0];
        //     const upperBound = filter[1];

        //     if (!lowerBound && upperBound) {
        //         return toNumeric <= upperBound;
        //     } else if (lowerBound && !upperBound) {
        //         return toNumeric >= lowerBound;
        //     } else if (lowerBound && upperBound) {
        //         return toNumeric >= lowerBound && toNumeric <= upperBound;
        //     } else if (!lowerBound && !upperBound) {
        //         return true;
        //     }
        // });
    };
};

export const createColumn = (
    columnId: string
):
    | DisplayColumnDef<ICurationTableStudy, ICurationTableColumnType>
    | AccessorFnColumnDef<ICurationTableStudy, ICurationTableColumnType> => {
    if (columnId === 'select') {
        return columnHelper.display({
            id: 'select',
            cell: CuratorTableSelectCell,
            header: CuratorTableSelectHeader,
            size: 60,
        });
    }
    if (columnId === 'summary') {
        return columnHelper.display({
            id: 'summary',
            cell: CuratorTableSummaryCell,
            header: CuratorTableSummaryHeader,
            size: 300,
        });
    }

    const foundColumn = COMBINED_CURATOR_TABLE_COLUMNS.find((COL) => COL.id === columnId);
    if (!foundColumn) throw new Error(`Unrecognized column ${columnId}`);

    let filterFn: FilterFnOption<ICurationTableStudy> | undefined;
    if (foundColumn.filterVariant === 'text' && !!foundColumn.AIExtractor) {
        filterFn = nestedTextFilter(foundColumn);
    } else if (foundColumn.filterVariant === 'text') {
        filterFn = 'includesString';
    } else if (foundColumn.filterVariant === 'numeric' && !!foundColumn.AIExtractor)
        filterFn = nestedNumericFilter(foundColumn);
    else if (foundColumn.filterVariant === 'numeric') filterFn = 'inNumberRange';
    else if (foundColumn.filterVariant === 'autocomplete' && !!foundColumn.AIExtractor)
        filterFn = nestedAutocompleteFilter(foundColumn);
    else if (foundColumn.filterVariant === 'autocomplete') filterFn = 'arrIncludesSome';
    else filterFn = undefined;

    const newColumn: AccessorFnColumnDef<ICurationTableStudy, ICurationTableColumnType> = columnHelper.accessor(
        foundColumn.customAccessor
            ? foundColumn.customAccessor
            : (stub) => stub[foundColumn.id as keyof ICurationTableStudy] as string,
        {
            id: foundColumn.id,
            cell: CuratorTableCell,
            header: CuratorTableHeader,
            enableSorting: foundColumn.canSort,
            enableColumnFilter: foundColumn.filterVariant !== undefined,
            filterFn: filterFn,
            size: foundColumn.size ? foundColumn.size : foundColumn.id === 'abstractText' ? 400 : 250,
            sortingFn: foundColumn.sortingFn,
            meta: {
                columnLabel: foundColumn.label,
                AIExtractor: foundColumn.AIExtractor,
                filterVariant: foundColumn.filterVariant,
            },
        }
    );
    return newColumn;
};

export const getGridTemplateColumns = (
    headersOrCells: (Cell<ICurationTableStudy, unknown> | Header<ICurationTableStudy, unknown>)[]
): string => {
    return headersOrCells.reduce((acc, curr) => {
        const size = curr.column.getSize();
        return `${acc} minmax(${size}px, ${curr.column.id === 'select' ? '60px' : `1fr`})`;
    }, '');
};
