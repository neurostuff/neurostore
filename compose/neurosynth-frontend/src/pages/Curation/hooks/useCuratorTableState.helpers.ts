import { AccessorFnColumnDef, createColumnHelper, DisplayColumnDef, FilterFnOption, Row } from '@tanstack/react-table';
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
    ICurationBoardAIInterfaceCuratorTableType,
    ICurationTableColumnType,
    ICurationTableStudy,
    PARTICIPANTS_DEMOGRAPHICS_EXTRACTOR_CURATOR_COLUMNS,
    STUB_CURATOR_COLUMNS,
    TASK_EXTRACTOR_CURATOR_COLUMNS,
} from './useCuratorTableState.types';

const columnHelper = createColumnHelper<ICurationTableStudy>();
const combinedColumns = [
    ...STUB_CURATOR_COLUMNS,
    ...PARTICIPANTS_DEMOGRAPHICS_EXTRACTOR_CURATOR_COLUMNS,
    ...TASK_EXTRACTOR_CURATOR_COLUMNS,
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
                if (val.value === null || val.value === undefined || val.value === 'null' || val.value === 'undefined')
                    return;
                if (Array.isArray(val.value)) {
                    val.value.forEach((v) => {
                        if (
                            val.value === null ||
                            val.value === undefined ||
                            val.value === 'null' ||
                            val.value === 'undefined'
                        )
                            return;
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

const nestedAutocompleteFilter: (
    column: ICurationBoardAIInterfaceCuratorTableType
) => FilterFnOption<ICurationTableStudy> = (column: ICurationBoardAIInterfaceCuratorTableType) => {
    return (row: Row<ICurationTableStudy>, colId: string, filter: string[] | undefined) => {
        if (!filter || filter.length === 0) return true;
        if (!column.AIExtractor || !row.original[column.AIExtractor] || !column.customAccessor) return false;

        /**
         * Technically this is overkill because this function should only be used for nested EAIExtractor output (IGenericCustomAccessorReturn)
         * However, just to be safe, we will handle all cases (ICurationTableColumnType)
         */
        const columnValue = column.customAccessor(row.original) as ICurationTableColumnType;
        const flattenedValues = flattenColumnValues(columnValue, true);

        return filter.every((filterValue) => flattenedValues.has(filterValue.toLowerCase()));
    };
};

export const createColumn = (
    columnId: string
):
    | DisplayColumnDef<ICurationTableStudy, unknown>
    | AccessorFnColumnDef<ICurationTableStudy, ICurationTableColumnType> => {
    if (columnId === 'select') {
        return columnHelper.display({
            id: 'select',
            cell: CuratorTableSelectCell,
            header: CuratorTableSelectHeader,
            size: 40,
        });
    }
    if (columnId === 'summary') {
        return columnHelper.display({
            id: 'summary',
            cell: CuratorTableSummaryCell,
            header: CuratorTableSummaryHeader,
            size: 250,
        });
    }

    const foundColumn = combinedColumns.find((COL) => COL.id === columnId);
    if (!foundColumn) throw new Error('Unrecognized column');
    const newColumn = columnHelper.accessor(
        foundColumn.customAccessor
            ? foundColumn.customAccessor
            : (stub) => stub[foundColumn.id as keyof ICurationTableStudy] as string,
        {
            id: foundColumn.id,
            cell: CuratorTableCell,
            header: CuratorTableHeader,
            enableSorting: foundColumn.canSort,
            enableColumnFilter: foundColumn.filterVariant !== undefined,
            filterFn:
                foundColumn.filterVariant === 'text'
                    ? 'includesString'
                    : foundColumn.filterVariant === 'numeric'
                      ? 'inNumberRange'
                      : foundColumn.filterVariant === 'autocomplete' && !!foundColumn.AIExtractor
                        ? nestedAutocompleteFilter(foundColumn)
                        : foundColumn.filterVariant === 'autocomplete'
                          ? 'arrIncludesAll'
                          : undefined,
            size: foundColumn.id === 'abstractText' ? 400 : 250,
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
