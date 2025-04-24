import { ArrowDownward, AutoAwesome, Delete } from '@mui/icons-material';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import { Box, IconButton, Typography } from '@mui/material';
import { HeaderContext } from '@tanstack/react-table';
import { ICurationTableStudy } from '../hooks/useCuratorTableState';
import CurationBoardAIInterfaceCuratorTableHeaderFilter from './CurationBoardAIInterfaceCuratorTableHeaderFilter';

export const CuratorTableHeader: React.FC<HeaderContext<ICurationTableStudy, unknown>> = ({ table, column }) => {
    const removeColumn = table.options.meta?.curatorTableOnRemoveColumn;
    const columnLabel = column.columnDef.meta?.columnLabel || '';
    const canSort = column.getCanSort();
    const isSorted = column.getIsSorted();
    const canFilter = column.getCanFilter();

    return (
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {column.columnDef.meta?.isAIExtracted ? (
                <Box sx={{ display: 'flex', alignItems: 'center', color: '#50b9db' }}>
                    <AutoAwesome sx={{ height: '16px' }} />
                    <Typography variant="body2" sx={{ marginRight: '10px', fontSize: '12px' }}>
                        AI
                    </Typography>
                </Box>
            ) : (
                <></>
            )}
            <Typography variant="body2" sx={{ marginRight: '4px' }}>
                {columnLabel}
            </Typography>
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
                            <ArrowDownward sx={{ height: '0.9em', width: '0.9em', color: 'lightgray' }} />
                        </IconButton>
                    ) : isSorted === 'asc' ? (
                        <IconButton size="small" onClick={() => table.resetSorting()}>
                            <ArrowUpwardIcon sx={{ height: '0.9em', width: '0.9em', color: 'secondary.main' }} />
                        </IconButton>
                    ) : (
                        <IconButton size="small" onClick={() => table.setSorting([{ id: column.id, desc: false }])}>
                            <ArrowDownward sx={{ height: '0.9em', width: '0.9em', color: 'secondary.main' }} />
                        </IconButton>
                    )}
                </>
            )}
            {canFilter && <CurationBoardAIInterfaceCuratorTableHeaderFilter column={column} />}
            <IconButton size="small" onClick={() => removeColumn && removeColumn(column.id)}>
                <Delete sx={{ height: '0.9em', width: '0.9em', color: 'error.light' }} />
            </IconButton>
        </Box>
    );
};
