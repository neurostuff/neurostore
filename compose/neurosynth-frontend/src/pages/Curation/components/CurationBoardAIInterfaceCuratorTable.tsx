import { Box, Table, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import {
    AccessorFnColumnDef,
    ColumnFiltersState,
    createColumnHelper,
    DisplayColumnDef,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getSortedRowModel,
    RowData,
    RowSelectionState,
    SortingColumnDef,
    SortingState,
    useReactTable,
} from '@tanstack/react-table';
import { NeurostoreStudyReturn } from 'neurosynth-compose-typescript-sdk';
import { useCallback, useMemo, useState } from 'react';
import { ICurationStubStudy } from '../Curation.types';
import { ICurationBoardAIInterfaceCurator } from './CurationBoardAIInterfaceCurator';
import CurationBoardAIInterfaceCuratorTableAddColumn from './CurationBoardAIInterfaceCuratorTableAddColumn';
import CurationBoardAIInterfaceCuratorTableBody from './CurationBoardAIInterfaceCuratorTableBody';
import CuratorTableCell from './CurationBoardAIInterfaceCuratorTableCell';
import { CuratorTableHeader } from './CurationBoardAIInterfaceCuratorTableHeader';
import { CuratorTableSelectCell, CuratorTableSelectHeader } from './CurationBoardAIInterfaceCuratorTableSelect';
import { CuratorTableSummaryCell, CuratorTableSummaryHeader } from './CurationBoardAIInterfaceCuratorTableSummary';
import CurationBoardAIInterfaceCuratorTableSelectedRowsActions from './CurationBoardAIInterfaceCuratorTableSelectedRowsActions';

export interface ICurationBoardAIInterfaceCuratorTableType {
    id: string;
    label: string;
    filterVariant: undefined | 'text' | 'numeric';
    canSort: boolean;
    sortingFn?: SortingColumnDef<ICurationTableStudy>['sortingFn'];
    customAccessor?: (stub: ICurationTableStudy) => string;
}

//allows us to define custom properties for our columns
declare module '@tanstack/react-table' {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    interface ColumnMeta<TData extends RowData, TValue> {
        columnLabel: string;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    interface TableMeta<TData extends RowData> {
        curatorTableOnRemoveColumn?: (column: string) => void;
        curatorTableOnAddColumn?: (column: string) => void;
    }
}

export type ICurationTableStudy = ICurationStubStudy & { neurostoreStudy?: NeurostoreStudyReturn };
const columnHelper = createColumnHelper<ICurationTableStudy>();

export const AI_INTERFACE_CURATOR_COLUMNS: ICurationBoardAIInterfaceCuratorTableType[] = [
    { id: 'articleYear', label: 'Year', filterVariant: 'numeric', canSort: true, sortingFn: 'alphanumeric' },
    { id: 'title', label: 'Title', filterVariant: 'text', canSort: true, sortingFn: 'text' },
    { id: 'authors', label: 'Authors', filterVariant: 'text', canSort: true, sortingFn: 'text' },
    { id: 'keywords', label: 'Keywords', filterVariant: 'text', canSort: true, sortingFn: 'text' },
    { id: 'pmid', label: 'PMID', filterVariant: 'text', canSort: true, sortingFn: 'alphanumeric' },
    { id: 'doi', label: 'DOI', filterVariant: 'text', canSort: true, sortingFn: 'alphanumeric' },
    { id: 'journal', label: 'Journal', filterVariant: 'text', canSort: true, sortingFn: 'text' },
    { id: 'abstractText', label: 'Abstract', filterVariant: undefined, canSort: true, sortingFn: 'text' },
    {
        id: 'identificationSource',
        label: 'Source',
        filterVariant: 'text',
        canSort: true,
        sortingFn: 'text',
        customAccessor: (stub) => stub.identificationSource.label,
    },
];

const CurationBoardAIInterfaceCuratorTable: React.FC<ICurationBoardAIInterfaceCurator> = ({
    stubs,
    onSetSelectedStub,
    columnIndex,
}) => {
    // for virtualization
    // const sizeMap = useRef<{ [key: number]: number }>({});

    // const setSize = useCallback((index: number, size: number) => {
    //     sizeMap.current[index] = size;
    // }, []);

    // const getSize = useCallback((index: number) => {
    //     return sizeMap.current[index] || 100;
    // }, []);

    const handleAddColumn = useCallback((column: string) => {
        setColumns((prev) => {
            const foundColumn = AI_INTERFACE_CURATOR_COLUMNS.find((COL) => COL.id === column);
            if (!foundColumn) return prev;
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
                            ? 'arrIncludesSome'
                            : foundColumn.filterVariant === 'numeric'
                              ? 'inNumberRange'
                              : undefined,
                    size: foundColumn.id === 'abstractText' ? 400 : 180,
                    sortingFn: foundColumn.sortingFn,
                    meta: {
                        columnLabel: foundColumn.label,
                        filterVariant: foundColumn.filterVariant,
                    },
                }
            );
            return [...prev, newColumn];
        });
    }, []);

    const handleRemoveColumn = useCallback((column: string) => {
        setColumns((prev) => {
            return prev.filter((col) => col.id !== column);
        });
        setSorting((prev) => {
            return prev.filter((col) => col.id !== column);
        });
    }, []);

    const [columns, setColumns] = useState<
        (DisplayColumnDef<ICurationTableStudy, unknown> | AccessorFnColumnDef<ICurationTableStudy, string>)[]
    >([
        columnHelper.display({
            id: 'select',
            cell: CuratorTableSelectCell,
            header: CuratorTableSelectHeader,
            size: 40,
        }),
        columnHelper.display({
            id: 'summary',
            cell: CuratorTableSummaryCell,
            header: CuratorTableSummaryHeader,
        }),
    ]);

    const [sorting, setSorting] = useState<SortingState>([]);
    const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

    const data = useMemo(() => {
        return [...stubs];
    }, [stubs]);

    const table = useReactTable({
        data: data,
        columns: columns,
        getCoreRowModel: getCoreRowModel(),
        onSortingChange: setSorting,
        getSortedRowModel: getSortedRowModel(),
        onRowSelectionChange: setRowSelection,
        enableRowSelection: true,
        enableMultiRowSelection: true,
        enableSubRowSelection: false,
        getRowId: (stub) => stub.id,
        getFilteredRowModel: getFilteredRowModel(),
        onColumnFiltersChange: setColumnFilters,
        state: {
            columnFilters: columnFilters,
            sorting: sorting,
            rowSelection: rowSelection,
        },
        meta: {
            curatorTableOnAddColumn: handleAddColumn,
            curatorTableOnRemoveColumn: handleRemoveColumn,
        },
    });

    return (
        <Box sx={{ padding: '0 2rem 2rem 2rem', height: '100%' }}>
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: Object.keys(rowSelection).length > 0 ? 'space-between' : 'flex-end',
                }}
            >
                {Object.keys(rowSelection).length > 0 && (
                    <CurationBoardAIInterfaceCuratorTableSelectedRowsActions table={table} columnIndex={columnIndex} />
                )}
                <CurationBoardAIInterfaceCuratorTableAddColumn
                    onAddColumn={handleAddColumn}
                    onRemoveColumn={handleRemoveColumn}
                    columns={columns}
                />
            </Box>
            <TableContainer sx={{ maxHeight: 'calc(100% - 48px - 32px - 2rem)' }}>
                <Table size="small" sx={{ tableLayout: 'fixed' }}>
                    <TableHead>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => (
                                    <TableCell
                                        key={header.id}
                                        sx={{
                                            padding: '4px 8px',
                                            width: `${header.column.getSize()}px`,
                                            verticalAlign: 'bottom',
                                        }}
                                    >
                                        <Box>{flexRender(header.column.columnDef.header, header.getContext())}</Box>
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))}
                    </TableHead>
                    <CurationBoardAIInterfaceCuratorTableBody onSelect={onSetSelectedStub} table={table} />
                </Table>
                {table.getRowModel().rows.length === 0 && (
                    <Typography sx={{ color: 'warning.dark', margin: '0.5rem 0', fontSize: '12px' }}>
                        No studies. To import studies, click the import button above.
                    </Typography>
                )}
            </TableContainer>
        </Box>
    );
};

export default CurationBoardAIInterfaceCuratorTable;
