import { Box, Chip, Table, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { flexRender, RowData } from '@tanstack/react-table';
import { useGetCurationSummary } from 'hooks';
import { ICurationBoardAIInterfaceCurator } from './CurationBoardAIInterfaceCurator';
import CurationBoardAIInterfaceCuratorTableBody from './CurationBoardAIInterfaceCuratorTableBody';
import CurationBoardAIInterfaceCuratorTableManageColumns from './CurationBoardAIInterfaceCuratorTableManageColumns';
import CurationBoardAIInterfaceCuratorTableSelectedRowsActions from './CurationBoardAIInterfaceCuratorTableSelectedRowsActions';

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

const CurationBoardAIInterfaceCuratorTable: React.FC<ICurationBoardAIInterfaceCurator> = ({
    table,
    onSetSelectedStub,
    columnIndex,
}) => {
    const { included, uncategorized } = useGetCurationSummary();

    // for virtualization
    // const sizeMap = useRef<{ [key: number]: number }>({});

    // const setSize = useCallback((index: number, size: number) => {
    //     sizeMap.current[index] = size;
    // }, []);

    // const getSize = useCallback((index: number) => {
    //     return sizeMap.current[index] || 100;
    // }, []);

    const numRowsSelected = table.getSelectedRowModel().rows.length;
    const numTotalRows = table.getCoreRowModel().rows.length;
    const columnFilters = table.getState().columnFilters;
    const sorting = table.getState().sorting;
    const curationIsComplete = included > 0 && uncategorized === 0;
    // const rows = table.getRowModel().rows;

    return (
        <Box sx={{ padding: '0 1rem 2rem 1rem', height: '100%' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '4px' }}>
                <Box sx={{ display: 'flex' }}>
                    {numRowsSelected > 0 && (
                        <CurationBoardAIInterfaceCuratorTableSelectedRowsActions
                            table={table}
                            columnIndex={columnIndex}
                        />
                    )}
                    <CurationBoardAIInterfaceCuratorTableManageColumns
                        onAddColumn={table.options.meta?.curatorTableOnAddColumn}
                        onRemoveColumn={table.options.meta?.curatorTableOnRemoveColumn}
                        columns={table.getAllColumns()}
                    />
                </Box>
                <Box sx={{ whiteSpace: 'nowrap' }}>
                    {columnFilters.length > 0 ? (
                        <Typography sx={{ fontSize: '12px' }}>
                            Viewing {table.getFilteredRowModel().rows.length} / {numTotalRows}
                        </Typography>
                    ) : (
                        <Typography sx={{ fontSize: '12px' }}>Total: {numTotalRows} studies</Typography>
                    )}
                </Box>
            </Box>
            <TableContainer sx={{ maxHeight: 'calc(100% - 48px - 32px - 2rem - 4px)' }}>
                <Table size="small" sx={{ tableLayout: 'fixed' }}>
                    <TableHead sx={{ position: 'sticky', top: 0, backgroundColor: 'white', zIndex: 999 }}>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => (
                                    <TableCell
                                        key={header.id}
                                        sx={{
                                            padding: '6px',
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
                    <Typography padding="0.5rem 0" color={curationIsComplete ? 'success.main' : 'warning.dark'}>
                        {curationIsComplete
                            ? "You're done! Go to extraction to continue your meta analysis"
                            : 'No studies. To import studies, click the import button above.'}
                    </Typography>
                )}
            </TableContainer>
            <Box sx={{ marginTop: '4px', display: 'flex', justifyContent: 'flex-end' }}>
                {columnFilters
                    .filter((filter) => !!filter.value)
                    .map((filter) => (
                        <Chip
                            onDelete={() => table.setColumnFilters((prev) => prev.filter((f) => f.id !== filter.id))}
                            key={filter.id}
                            variant="outlined"
                            color="secondary"
                            sx={{ margin: '1px', fontSize: '10px', maxWidth: '200px', height: '18px' }}
                            label={`Filtering ${filter.id.toUpperCase()}: ${filter.value}`}
                            size="small"
                        />
                    ))}
                {sorting.map((sort) => (
                    <Chip
                        key={sort.id}
                        onDelete={() => {
                            table.setSorting((prev) => prev.filter((f) => f.id !== sort.id));
                        }}
                        variant="outlined"
                        color="secondary"
                        sx={{ fontSize: '10px', maxWidth: '200px', padding: '0px', height: '18px' }}
                        label={`Sorting by ${sort.id.toUpperCase()}: ${sort.desc ? 'desc' : 'asc'}`}
                        size="small"
                    />
                ))}
            </Box>
        </Box>
    );
};

export default CurationBoardAIInterfaceCuratorTable;
