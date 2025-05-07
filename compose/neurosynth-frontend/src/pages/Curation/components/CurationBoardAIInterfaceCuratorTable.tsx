import { Box, Chip, Table, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { flexRender, RowData } from '@tanstack/react-table';
import { useGetCurationSummary } from 'hooks';
import { ICurationBoardAIInterfaceCurator } from './CurationBoardAIInterfaceCurator';
import CurationBoardAIInterfaceCuratorTableBody from './CurationBoardAIInterfaceCuratorTableBody';
import CurationBoardAIInterfaceCuratorTableManageColumns from './CurationBoardAIInterfaceCuratorTableManageColumns';
import CurationBoardAIInterfaceCuratorTableSelectedRowsActions from './CurationBoardAIInterfaceCuratorTableSelectedRowsActions';
import { useCallback, useEffect, useRef } from 'react';
import { EAIExtractors } from 'hooks/extractions/useGetAllExtractedData';

//allows us to define custom properties for our columns
declare module '@tanstack/react-table' {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    interface ColumnMeta<TData extends RowData, TValue> {
        columnLabel: string;
        AIExtractor?: EAIExtractors;
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
    selectedStub,
    columnIndex,
}) => {
    const { included, uncategorized } = useGetCurationSummary();

    const numRowsSelected = table.getSelectedRowModel().rows.length;
    const columnFilters = table.getState().columnFilters;
    const sorting = table.getState().sorting;
    const curationIsComplete = included > 0 && uncategorized === 0;

    useEffect(() => {
        if (!selectedStub) return;
        const row = document.getElementById(selectedStub.id);
        const scroller = document.getElementById('scroller');
        if (!row || !scroller) return;
        scroller.scroll(0, row.offsetTop - 26 - scroller.clientHeight / 2 + row.clientHeight / 2);
    }, [selectedStub, table]);

    return (
        <Box sx={{ padding: '0 1rem 2rem 1rem', height: '100%' }}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-start', paddingBottom: '4px' }}>
                {numRowsSelected > 0 && (
                    <CurationBoardAIInterfaceCuratorTableSelectedRowsActions table={table} columnIndex={columnIndex} />
                )}
                <CurationBoardAIInterfaceCuratorTableManageColumns
                    onAddColumn={table.options.meta?.curatorTableOnAddColumn}
                    onRemoveColumn={table.options.meta?.curatorTableOnRemoveColumn}
                    columns={table.getAllColumns()}
                />
            </Box>
            <TableContainer
                id="scroller"
                sx={{
                    maxHeight: 'calc(100% - 48px - 32px - 2rem - 4px)',
                    minHeight: 'calc(100% - 48px - 32px - 2rem - 4px)',
                }}
            >
                <Table size="small" sx={{ tableLayout: 'fixed' }}>
                    <TableHead sx={{ position: 'sticky', top: 0, backgroundColor: 'white', zIndex: 999 }}>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => (
                                    <TableCell
                                        key={header.id}
                                        sx={{
                                            position: header.column.id === 'select' ? 'sticky' : '',
                                            backgroundColor: 'white',
                                            zIndex: 9999,
                                            left: 0,
                                            padding: '7px 0px',
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
