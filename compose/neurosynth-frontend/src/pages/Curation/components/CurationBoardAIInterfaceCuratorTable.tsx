import { Box, Chip, Table, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import { flexRender, RowData } from '@tanstack/react-table';
import { EAIExtractors } from 'hooks/extractions/useGetAllExtractedDataForStudies';
import { indexToPRISMAMapping } from 'hooks/projects/useGetProjects';
import { useProjectCurationPrismaConfig } from 'stores/projects/ProjectStore';
import React, { useState } from 'react';
import { getGridTemplateColumns } from '../hooks/useCuratorTableState.helpers';
import { ICurationBoardAIInterfaceCurator } from './CurationBoardAIInterfaceCurator';
import CurationBoardAIInterfaceCuratorTableBody from './CurationBoardAIInterfaceCuratorTableBody';
import CurationBoardAIInterfaceCuratorTableHints from './CurationBoardAIInterfaceCuratorTableHints';
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
    const prismaConfig = useProjectCurationPrismaConfig();
    const prismaPhase = prismaConfig.isPrisma ? indexToPRISMAMapping(columnIndex) : undefined;

    const [tableContainerElement, setTableContainerElement] = useState<HTMLDivElement | null>(null);

    const numRowsSelected = table.getSelectedRowModel().rows.length;
    const columnFilters = table.getState().columnFilters;
    const sorting = table.getState().sorting;

    const handleClearAllFilters = () => {
        table.setColumnFilters([]);
        table.setSorting([]);
    };

    return (
        <Box sx={{ padding: '0 1rem 2rem 1rem', height: '100%' }}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-start', paddingBottom: '8px' }}>
                {numRowsSelected > 0 && (
                    <CurationBoardAIInterfaceCuratorTableSelectedRowsActions table={table} columnIndex={columnIndex} />
                )}
                <CurationBoardAIInterfaceCuratorTableManageColumns
                    onAddColumn={table.options.meta?.curatorTableOnAddColumn}
                    onRemoveColumn={table.options.meta?.curatorTableOnRemoveColumn}
                    columns={table.getAllColumns()}
                    allowAIColumns={prismaPhase !== 'identification'}
                />
            </Box>
            <Box sx={{ maxWidth: '100%', width: '100%', overflow: 'hidden', display: 'flex' }}>
                {(columnFilters.length > 0 || sorting.length > 0) && (
                    <Chip
                        size="small"
                        onClick={handleClearAllFilters}
                        sx={{ margin: '0px 2px', fontSize: '10px', maxWidth: '200px', height: '18px' }}
                        label="Clear"
                        color="info"
                        variant="outlined"
                    />
                )}
                <Box sx={{ display: 'flex', overflowX: 'auto', scrollbarColor: '#c1c1c1 white' }}>
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
            <TableContainer
                ref={setTableContainerElement}
                id="scroller"
                sx={{
                    maxHeight: 'calc(100% - 48px - 32px - 2.5rem)',
                    minHeight: 'calc(100% - 48px - 32px - 2.5rem)',
                    height: 'calc(100% - 48px - 32px - 2.5rem)',
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
                                            padding: '7px 0px',
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
                        tableContainerElement={tableContainerElement}
                        selectedStub={selectedStub}
                    />
                </Table>
                {table.getRowModel().rows.length === 0 && (
                    <CurationBoardAIInterfaceCuratorTableHints
                        table={table}
                        numVisibleStudies={table.getRowModel().rows.length}
                        columnIndex={columnIndex}
                    />
                )}
            </TableContainer>
        </Box>
    );
};

export default CurationBoardAIInterfaceCuratorTable;
