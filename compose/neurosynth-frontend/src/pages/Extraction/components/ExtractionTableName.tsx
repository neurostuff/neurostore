import { Box, IconButton, Link, Tooltip, Typography } from '@mui/material';
import { CellContext, HeaderContext } from '@tanstack/react-table';
import { IExtractionTableStudy } from './ExtractionTable';
import { ArrowDownward } from '@mui/icons-material';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';

export const ExtractionTableNameCell: React.FC<CellContext<IExtractionTableStudy, string>> = (
    props
) => {
    const value = props.getValue();
    return (
        <Typography variant="body2" fontWeight="bold">
            {value}
        </Typography>
    );
};

export const ExtractionTableNameHeader: React.FC<HeaderContext<IExtractionTableStudy, string>> = ({
    table,
    column,
}) => {
    const isSorted = column.getIsSorted();
    return (
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Tooltip title="Sort by name" placement="top">
                <Typography
                    sx={{ ':hover': { cursor: 'pointer' } }}
                    underline="hover"
                    variant="h6"
                    component={Link}
                    onClick={() => {
                        if (!!isSorted) {
                            table.resetSorting();
                        } else {
                            table.setSorting([{ id: 'name', desc: true }]);
                        }
                    }}
                >
                    Name
                </Typography>
            </Tooltip>
            {!!isSorted && (
                <>
                    {isSorted === 'asc' ? (
                        <IconButton
                            size="small"
                            onClick={() => table.setSorting([{ id: 'name', desc: true }])}
                        >
                            <ArrowUpwardIcon />
                        </IconButton>
                    ) : (
                        <IconButton
                            size="small"
                            onClick={() => table.setSorting([{ id: 'name', desc: false }])}
                        >
                            <ArrowDownward />
                        </IconButton>
                    )}
                </>
            )}
        </Box>
    );
};
