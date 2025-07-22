import { ArrowDownward, Delete } from '@mui/icons-material';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import { HeaderContext } from '@tanstack/react-table';
import AIICon from 'components/AIIcon';
import { ICurationTableColumnType, ICurationTableStudy } from '../hooks/useCuratorTableState.types';
import CurationBoardAIInterfaceCuratorTableHeaderFilter from './CurationBoardAIInterfaceCuratorTableHeaderFilter';

export const CuratorTableHeader: React.FC<HeaderContext<ICurationTableStudy, ICurationTableColumnType>> = ({
    table,
    column,
}) => {
    const removeColumn = table.options.meta?.curatorTableOnRemoveColumn;
    const columnLabel = column.columnDef.meta?.columnLabel || '';
    const canSort = column.getCanSort();
    const isSorted = column.getIsSorted();
    const canFilter = column.getCanFilter();

    const filteredRows = table.getFilteredRowModel().rows;
    const allRows = table.getCoreRowModel().rows;

    return (
        <Box
            sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-start',
                overflow: 'hidden',
                padding: '3px 0',
            }}
        >
            {column.columnDef.meta?.AIExtractor ? <AIICon sx={{ marginRight: '4px' }} /> : <></>}
            <Tooltip title={columnLabel} placement="top">
                <Typography variant="body2" sx={{ marginRight: '2px' }} noWrap>
                    {columnLabel}
                </Typography>
            </Tooltip>
            {canSort && (
                <>
                    {!isSorted ? (
                        <IconButton
                            size="small"
                            onClick={() => {
                                if (isSorted) {
                                    table.resetSorting();
                                } else {
                                    table.setSorting([{ id: column.id, desc: true }]);
                                }
                            }}
                        >
                            <ArrowDownward sx={{ height: '0.8em', width: '0.8em', color: 'lightgray' }} />
                        </IconButton>
                    ) : isSorted === 'asc' ? (
                        <IconButton size="small" onClick={() => table.resetSorting()}>
                            <ArrowUpwardIcon sx={{ height: '0.8em', width: '0.8em', color: 'secondary.main' }} />
                        </IconButton>
                    ) : (
                        <IconButton size="small" onClick={() => table.setSorting([{ id: column.id, desc: false }])}>
                            <ArrowDownward sx={{ height: '0.8em', width: '0.8em', color: 'secondary.main' }} />
                        </IconButton>
                    )}
                </>
            )}
            {canFilter && (
                <CurationBoardAIInterfaceCuratorTableHeaderFilter
                    filteredRows={filteredRows}
                    allRows={allRows}
                    column={column}
                />
            )}
            <IconButton size="small" onClick={() => removeColumn && removeColumn(column.id)}>
                <Delete sx={{ height: '0.8em', width: '0.8em', color: 'error.light' }} />
            </IconButton>
        </Box>
    );
};
