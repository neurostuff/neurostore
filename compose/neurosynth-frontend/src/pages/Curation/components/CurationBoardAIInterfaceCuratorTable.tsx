import {
    Box,
    Button,
    Card,
    CardActions,
    CardContent,
    Chip,
    Table,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography,
} from '@mui/material';
import { flexRender, RowData } from '@tanstack/react-table';
import { useGetCurationSummary } from 'hooks';
import { EAIExtractors } from 'hooks/extractions/useGetAllExtractedDataForStudies';
import { indexToPRISMAMapping } from 'hooks/projects/useGetProjects';
import { useProjectCurationPrismaConfig } from 'pages/Project/store/ProjectStore';
import React, { useRef } from 'react';
import { getGridTemplateColumns } from '../hooks/useCuratorTableState.helpers';
import { ICurationBoardAIInterfaceCurator } from './CurationBoardAIInterfaceCurator';
import CurationBoardAIInterfaceCuratorTableBody from './CurationBoardAIInterfaceCuratorTableBody';
import CurationBoardAIInterfaceCuratorTableManageColumns from './CurationBoardAIInterfaceCuratorTableManageColumns';
import CurationBoardAIInterfaceCuratorTableSelectedRowsActions from './CurationBoardAIInterfaceCuratorTableSelectedRowsActions';
import ImportStudiesButton from 'pages/CurationImport/components/ImportStudiesButton';
import CurationBoardAIInterfaceCuratorTableEmptyState from './CurationBoardAIInterfaceCuratorTableEmptyState';

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
    selectedGroup,
    groups,
    onSetSelectedGroup,
}) => {
    const { included, uncategorized, excluded } = useGetCurationSummary();
    const prismaConfig = useProjectCurationPrismaConfig();
    const prismaPhase = prismaConfig.isPrisma ? indexToPRISMAMapping(columnIndex) : undefined;

    const tableContainerRef = useRef<HTMLDivElement>(null);

    const numRowsSelected = table.getSelectedRowModel().rows.length;
    const columnFilters = table.getState().columnFilters;
    const sorting = table.getState().sorting;

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
            <Box sx={{ maxWidth: '100%', width: '100%', overflow: 'hidden' }}>
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
                ref={tableContainerRef}
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
                        tableContainerRef={tableContainerRef}
                        selectedStub={selectedStub}
                    />
                </Table>
                {table.getRowModel().rows.length === 0 && (
                    <Box
                        sx={{
                            display: 'flex',
                            height: 'calc(100% - 53px)',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 2,
                            boxSizing: 'border-box',
                            width: '100%',
                        }}
                    >
                        <CurationBoardAIInterfaceCuratorTableEmptyState
                            numIncluded={included}
                            numUncategorized={uncategorized}
                            numExcluded={excluded}
                            columnIndex={columnIndex}
                            isPrisma={prismaConfig.isPrisma}
                            selectedGroup={selectedGroup}
                            groups={groups}
                            onSetSelectedGroup={onSetSelectedGroup}
                        />
                    </Box>
                )}
            </TableContainer>
        </Box>
    );
};

export default CurationBoardAIInterfaceCuratorTable;
