import { AccessorFnColumnDef, createColumnHelper, DisplayColumnDef } from '@tanstack/react-table';
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
    STUB_CURATOR_COLUMNS,
    ICurationTableStudy,
    PARTICIPANTS_DEMOGRAPHICS_EXTRACTOR_CURATOR_COLUMNS,
    TASK_EXTRACTOR_CURATOR_COLUMNS,
    IGenericCustomAccessorReturn,
} from './useCuratorTableState.types';

const columnHelper = createColumnHelper<ICurationTableStudy>();

const combinedColumns = [
    ...STUB_CURATOR_COLUMNS,
    ...PARTICIPANTS_DEMOGRAPHICS_EXTRACTOR_CURATOR_COLUMNS,
    ...TASK_EXTRACTOR_CURATOR_COLUMNS,
];

export const createColumn = (
    columnId: string
):
    | DisplayColumnDef<ICurationTableStudy, unknown>
    | AccessorFnColumnDef<ICurationTableStudy, IGenericCustomAccessorReturn> => {
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
                      : undefined,
            size: foundColumn.id === 'abstractText' ? 400 : 180,
            sortingFn: foundColumn.sortingFn,
            meta: {
                columnLabel: foundColumn.label,
                isAIExtracted: foundColumn.isAIExtracted,
                filterVariant: foundColumn.filterVariant,
            },
        }
    );
    return newColumn;
};
