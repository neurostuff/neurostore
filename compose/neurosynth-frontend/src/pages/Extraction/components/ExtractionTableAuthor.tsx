import { ArrowDownward } from '@mui/icons-material';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import { CellContext, HeaderContext } from '@tanstack/react-table';
import { IExtractionTableStudy } from './ExtractionTable';
import { getAuthorsShortName } from 'helpers/utils';

export const ExtractionTableAuthorCell: React.FC<CellContext<IExtractionTableStudy, string>> = (props) => {
    const value = props.getValue();
    const shortName = getAuthorsShortName(value);
    return (
        <Tooltip title={value ? <Typography variant="body2">{value}</Typography> : null}>
            <Typography variant="body2">{shortName}</Typography>
        </Tooltip>
    );
};

export const ExtractionTableAuthorHeader: React.FC<HeaderContext<IExtractionTableStudy, string>> = ({
    table,
    column,
}) => {
    const columnLabel = column.columnDef.meta?.columnLabel || '';
    const isSorted = column.getIsSorted();

    return (
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Typography sx={{ marginRight: '4px' }} variant="h6">
                {columnLabel}
            </Typography>
            {!isSorted ? (
                <Tooltip title="Sort by author" placement="top">
                    <IconButton
                        size="small"
                        onClick={() => {
                            if (isSorted) {
                                table.resetSorting();
                            } else {
                                table.setSorting([{ id: 'authors', desc: true }]);
                            }
                        }}
                    >
                        <ArrowDownward sx={{ width: '0.9em', height: '0.9em', color: 'lightgray' }} />
                    </IconButton>
                </Tooltip>
            ) : isSorted === 'asc' ? (
                <IconButton size="small" onClick={() => table.resetSorting()}>
                    <ArrowUpwardIcon sx={{ width: '0.9em', height: '0.9em', color: 'secondary.main' }} />
                </IconButton>
            ) : (
                <IconButton size="small" onClick={() => table.setSorting([{ id: 'authors', desc: false }])}>
                    <ArrowDownward sx={{ width: '0.9em', height: '0.9em', color: 'secondary.main' }} />
                </IconButton>
            )}
        </Box>
    );
};
