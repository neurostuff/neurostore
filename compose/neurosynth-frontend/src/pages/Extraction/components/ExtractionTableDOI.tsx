import { ArrowDownward } from '@mui/icons-material';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import { CellContext, HeaderContext } from '@tanstack/react-table';
import { IExtractionTableStudy } from './ExtractionTable';

export const ExtractionTableDOICell: React.FC<CellContext<IExtractionTableStudy, string>> = (props) => {
    const value = props.getValue();
    return (
        <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
            {value}
        </Typography>
    );
};

export const ExtractionTableDOIHeader: React.FC<HeaderContext<IExtractionTableStudy, string>> = ({ table, column }) => {
    const isSorted = column.getIsSorted();
    return (
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Typography sx={{ marginRight: '4px' }} variant="h6">
                DOI
            </Typography>
            {!isSorted ? (
                <Tooltip title="Sort by DOI" placement="top">
                    <IconButton
                        size="small"
                        onClick={() => {
                            if (!!isSorted) {
                                table.resetSorting();
                            } else {
                                table.setSorting([{ id: 'doi', desc: true }]);
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
                <IconButton size="small" onClick={() => table.setSorting([{ id: 'doi', desc: false }])}>
                    <ArrowDownward sx={{ height: '0.9em', width: '0.9em', color: 'secondary.main' }} />
                </IconButton>
            )}
        </Box>
    );
};
