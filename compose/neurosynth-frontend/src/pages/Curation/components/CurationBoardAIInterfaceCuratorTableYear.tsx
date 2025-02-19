import { ArrowDownward, Delete, FilterList } from '@mui/icons-material';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import { CellContext, HeaderContext } from '@tanstack/react-table';
import { ICurationTableStudy } from './CurationBoardAIInterfaceCuratorTable';

export const CuratorTableYearCell: React.FC<CellContext<ICurationTableStudy, string>> = (props) => {
    const value = props.getValue();
    return (
        <Typography variant="caption" sx={{ color: value ? 'inherit' : 'warning.dark', fontSize: '10px' }}>
            {value || 'no year'}
        </Typography>
    );
};

export const CuratorTableYearHeader: React.FC<HeaderContext<ICurationTableStudy, string>> = ({ table, column }) => {
    const isSorted = column.getIsSorted();

    return (
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Typography variant="body2" sx={{ marginRight: '4px' }}>
                Year
            </Typography>
            {!isSorted ? (
                <Tooltip title="Sort by Year" placement="top">
                    <IconButton
                        size="small"
                        onClick={() => {
                            if (isSorted) {
                                table.resetSorting();
                            } else {
                                table.setSorting([{ id: 'year', desc: true }]);
                            }
                        }}
                    >
                        <ArrowDownward sx={{ height: '0.9em', width: '0.9em', color: 'lightgray' }} />
                    </IconButton>
                </Tooltip>
            ) : isSorted === 'asc' ? (
                <IconButton size="small" onClick={() => table.resetSorting()}>
                    <ArrowUpwardIcon sx={{ height: '0.9em', width: '0.9em', color: 'secondary.main' }} />
                </IconButton>
            ) : (
                <IconButton size="small" onClick={() => table.setSorting([{ id: 'year', desc: false }])}>
                    <ArrowDownward sx={{ height: '0.9em', width: '0.9em', color: 'secondary.main' }} />
                </IconButton>
            )}
            <IconButton size="small">
                <FilterList sx={{ height: '0.9em', width: '0.9em', color: 'lightgray' }} />
            </IconButton>
            <IconButton size="small">
                <Delete sx={{ height: '0.9em', width: '0.9em', color: 'error.light' }} />
            </IconButton>
        </Box>
    );
};
