import { ArrowDownward } from '@mui/icons-material';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import { CellContext, HeaderContext } from '@tanstack/react-table';
import { IExtractionTableStudy } from './ExtractionTable';

export const ExtractionTableAuthorCell: React.FC<CellContext<IExtractionTableStudy, string>> = (
    props
) => {
    const value = props.getValue();
    return <Typography variant="body2">{value}</Typography>;
};

export const ExtractionTableAuthorHeader: React.FC<
    HeaderContext<IExtractionTableStudy, string>
> = ({ table, column }) => {
    const isSorted = column.getIsSorted();

    return (
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Typography sx={{ marginRight: '4px' }} variant="h6">
                Authors
            </Typography>
            {!isSorted ? (
                <Tooltip title="Sort by author" placement="top">
                    <IconButton
                        size="small"
                        onClick={() => {
                            if (!!isSorted) {
                                table.resetSorting();
                            } else {
                                table.setSorting([{ id: 'authors', desc: true }]);
                            }
                        }}
                    >
                        <ArrowDownward
                            sx={{ width: '0.9em', height: '0.9em', color: 'lightgray' }}
                        />
                    </IconButton>
                </Tooltip>
            ) : isSorted === 'asc' ? (
                <IconButton size="small" onClick={() => table.resetSorting()}>
                    sx={{ width: '' }}
                    <ArrowUpwardIcon
                        sx={{ width: '0.9em', height: '0.9em', color: 'secondary.main' }}
                    />
                </IconButton>
            ) : (
                <IconButton
                    size="small"
                    sx={{ width: '' }}
                    onClick={() => table.setSorting([{ id: 'authors', desc: false }])}
                >
                    <ArrowDownward
                        sx={{ width: '0.9em', height: '0.9em', color: 'secondary.main' }}
                    />
                </IconButton>
            )}
        </Box>
    );
};
