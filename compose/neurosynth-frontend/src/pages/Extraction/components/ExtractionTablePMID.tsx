import { ArrowDownward, ArrowUpward } from '@mui/icons-material';
import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import { CellContext, HeaderContext } from '@tanstack/react-table';
import { IExtractionTableStudy } from './ExtractionTable';

export const ExtractionTablePMIDCell = (props: CellContext<IExtractionTableStudy, string>) => {
    const value = props.getValue();
    return (
        <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
            {value}
        </Typography>
    );
};

export const ExtractionTablePMIDHeader = ({ column, table }: HeaderContext<IExtractionTableStudy, string>) => {
    const columnLabel = column.columnDef.meta?.columnLabel || '';
    const isSorted = column.getIsSorted();
    return (
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Typography variant="h6" sx={{ marginRight: '4px' }}>
                {columnLabel}
            </Typography>
            {!isSorted ? (
                <Tooltip title="Sort by PMID" placement="top">
                    <IconButton
                        size="small"
                        onClick={() => {
                            if (isSorted) {
                                table.resetSorting();
                            } else {
                                table.setSorting([{ id: 'pmid', desc: true }]);
                            }
                        }}
                    >
                        <ArrowDownward sx={{ height: '0.9em', width: '0.9em', color: 'lightgray' }} />
                    </IconButton>
                </Tooltip>
            ) : isSorted === 'asc' ? (
                <IconButton size="small" onClick={() => table.resetSorting()}>
                    <ArrowUpward sx={{ height: '0.9em', width: '0.9em', color: 'secondary.main' }} />
                </IconButton>
            ) : (
                <IconButton size="small" onClick={() => table.setSorting([{ id: 'pmid', desc: false }])}>
                    <ArrowDownward sx={{ height: '0.9em', width: '0.9em', color: 'secondary.main' }} />
                </IconButton>
            )}
        </Box>
    );
};
