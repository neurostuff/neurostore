import { Box, Chip, Table, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { flexRender, RowData } from '@tanstack/react-table';
import { useGetCurationSummary } from 'hooks';
import { EAIExtractors } from 'hooks/extractions/useGetAllExtractedData';
import { useRef } from 'react';
import { getGridTemplateColumns } from '../hooks/useCuratorTableState.helpers';
import { ICurationBoardAIInterfaceCurator } from './CurationBoardAIInterfaceCurator';
import CurationBoardAIInterfaceCuratorTableBody from './CurationBoardAIInterfaceCuratorTableBody';
import CurationBoardAIInterfaceCuratorTableManageColumns from './CurationBoardAIInterfaceCuratorTableManageColumns';
import CurationBoardAIInterfaceCuratorTableSelectedRowsActions from './CurationBoardAIInterfaceCuratorTableSelectedRowsActions';

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

    const tableContainerRef = useRef<HTMLDivElement>(null);

    const numRowsSelected = table.getSelectedRowModel().rows.length;
    const columnFilters = table.getState().columnFilters;
    const sorting = table.getState().sorting;
    const curationIsComplete = included > 0 && uncategorized === 0;

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
                ref={tableContainerRef}
                id="scroller"
                sx={{
                    maxHeight: 'calc(100% - 48px - 32px - 2.5rem)',
                    minHeight: 'calc(100% - 48px - 32px - 2.5rem)',
                    overflow: 'auto',
                    position: 'relative',
                    width: '100%',
                    scrollbarColor: '#c1c1c1 white',
                }}
            >
                <Table size="small" style={{ display: 'grid', width: '100%' }}>
                    <TableHead
                        style={{ display: 'grid', position: 'sticky', top: 0, backgroundColor: 'white', zIndex: 999 }}
                    >
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow
                                key={headerGroup.id}
                                style={{
                                    display: 'grid',
                                    width: '100%',
                                    gridTemplateColumns: getGridTemplateColumns(headerGroup.headers),
                                    gridAutoFlow: 'column',
                                    position: 'sticky',
                                    backgroundColor: 'white',
                                }}
                            >
                                {headerGroup.headers.map((header) => (
                                    <TableCell
                                        key={header.id}
                                        style={{
                                            display: 'grid',
                                            position: header.column.id === 'select' ? 'sticky' : undefined,
                                            left: header.column.id === 'select' ? 0 : undefined,
                                            zIndex: header.column.id === 'select' ? 999 : undefined,
                                            backgroundColor: 'white',
                                            padding: '6px',
                                        }}
                                    >
                                        {flexRender(header.column.columnDef.header, header.getContext())}
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))}
                    </TableHead>
                    <CurationBoardAIInterfaceCuratorTableBody
                        onSelect={onSetSelectedStub}
                        table={table}
                        tableContainerRef={tableContainerRef}
                        selectedStub={selectedStub}
                    />
                </Table>
                {table.getRowModel().rows.length === 0 && (
                    <Typography padding="0.5rem 0" color={curationIsComplete ? 'success.main' : 'warning.dark'}>
                        {curationIsComplete
                            ? "You're done! Go to extraction to continue your meta analysis"
                            : 'No studies. To import studies, click the import button above.'}
                    </Typography>
                )}
            </TableContainer>
            <Box
                sx={{
                    maxWidth: '100%',
                    width: '100%',
                    overflow: 'hidden',
                }}
            >
                <Box sx={{ display: 'flex', overflowX: 'scroll', scrollbarColor: '#c1c1c1 white' }}>
                    {columnFilters
                        .filter((filter) => !!filter.value)
                        .map((filter) => (
                            <Chip
                                onDelete={() =>
                                    table.setColumnFilters((prev) => prev.filter((f) => f.id !== filter.id))
                                }
                                key={filter.id}
                                variant="outlined"
                                color="secondary"
                                sx={{ margin: '0px 2px', fontSize: '10px', maxWidth: '200px', height: '18px' }}
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
                            variant="filled"
                            color="secondary"
                            sx={{ margin: '0px 2px', fontSize: '10px', maxWidth: '200px', height: '18px' }}
                            label={`Sorting by ${sort.id.toUpperCase()}: ${sort.desc ? 'desc' : 'asc'}`}
                            size="small"
                        />
                    ))}
                </Box>
            </Box>
        </Box>
    );
};

export default CurationBoardAIInterfaceCuratorTable;
