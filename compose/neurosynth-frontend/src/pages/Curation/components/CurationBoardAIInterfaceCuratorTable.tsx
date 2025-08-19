import { Box, Chip, Table, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { flexRender, RowData } from '@tanstack/react-table';
import { useGetCurationSummary } from 'hooks';
import { EAIExtractors } from 'hooks/extractions/useGetAllExtractedData';
import { indexToPRISMAMapping } from 'hooks/projects/useGetProjects';
import { useProjectCurationPrismaConfig } from 'pages/Project/store/ProjectStore';
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

export const getStatusText = (
    numIncluded: number,
    numUncategorized: number,
    numExcluded: number,
    columnIndex: number,
    isPrisma: boolean
): { statusColor: string | undefined; statusText: string } => {
    const noStudiesInCuration = numIncluded === 0 && numUncategorized === 0 && numExcluded === 0;
    if (noStudiesInCuration) {
        return {
            statusColor: 'warning.dark',
            statusText: 'No studies. To import studies, click the import button above.',
        };
    }

    const returnObject: {
        statusColor: string | undefined;
        statusText: string;
    } = {
        statusColor: undefined,
        statusText: '',
    };
    const curationIsComplete = numIncluded > 0 && numUncategorized === 0;
    if (isPrisma) {
        const prismaPhase = indexToPRISMAMapping(columnIndex);
        if (curationIsComplete) {
            returnObject.statusColor = 'success.main';
            returnObject.statusText = `You've reviewed all uncategorized studies in ${prismaPhase}! Go to extraction to continue your meta-analysis or import more studies to continue`;
        } else if (prismaPhase === 'identification') {
            returnObject.statusColor = undefined;
            returnObject.statusText = `No studies to review for identification. Import more studies, or continue onto the screening step`;
        } else if (prismaPhase === 'screening') {
            returnObject.statusColor = undefined;
            returnObject.statusText = `No studies to review for screening. Promote duplicated studies from identification, or continue onto the eligibility step`;
        } else if (prismaPhase === 'eligibility') {
            returnObject.statusColor = undefined;
            returnObject.statusText = `No studies to review for eligibility. Promote non excluded studies from screening to continue`;
        } else if (prismaPhase === undefined) {
            returnObject.statusColor = undefined;
            returnObject.statusText = 'No included studies. Promote non excluded studies from eligibility to continue';
        }
    } else {
        if (curationIsComplete) {
            returnObject.statusColor = 'success.main';
            returnObject.statusText =
                "You've reviewed all the uncategorized studies! Go to extraction to continue your meta-analysis or import more studies to continue";
        } else if (columnIndex === 0) {
            returnObject.statusColor = undefined;
            returnObject.statusText = 'No studies to review. Import more studies to continue';
        } else {
            // included
            returnObject.statusColor = undefined;
            returnObject.statusText = 'No included studies. Promote non excluded studies from "Unreviewed" to continue';
        }
    }

    return returnObject;
};

const CurationBoardAIInterfaceCuratorTable: React.FC<ICurationBoardAIInterfaceCurator> = ({
    table,
    onSetSelectedStub,
    selectedStub,
    columnIndex,
}) => {
    const { included, uncategorized, excluded } = useGetCurationSummary();
    const prismaConfig = useProjectCurationPrismaConfig();
    const prismaPhase = prismaConfig.isPrisma ? indexToPRISMAMapping(columnIndex) : undefined;

    const tableContainerRef = useRef<HTMLDivElement>(null);

    const numRowsSelected = table.getSelectedRowModel().rows.length;
    const columnFilters = table.getState().columnFilters;
    const sorting = table.getState().sorting;

    const { statusColor, statusText } = getStatusText(
        included,
        uncategorized,
        excluded,
        columnIndex,
        prismaConfig.isPrisma
    );

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
                    allowAIColumns={prismaPhase !== 'identification'}
                />
            </Box>
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
                    <Typography padding="0.5rem 0" color={statusColor}>
                        {statusText}
                    </Typography>
                )}
            </TableContainer>
        </Box>
    );
};

export default CurationBoardAIInterfaceCuratorTable;
