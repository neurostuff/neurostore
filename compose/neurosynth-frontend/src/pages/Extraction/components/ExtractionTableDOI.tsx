import { Box, IconButton, Link, Tooltip, Typography } from '@mui/material';
import { CellContext, HeaderContext } from '@tanstack/react-table';
import { IExtractionTableStudy } from './ExtractionTable';
import { ArrowDownward } from '@mui/icons-material';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';

export const ExtractionTableDOICell: React.FC<CellContext<IExtractionTableStudy, string>> = (
    props
) => {
    const value = props.getValue();
    return (
        <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
            {value}
        </Typography>
    );
};

export const ExtractionTableDOIHeader: React.FC<HeaderContext<IExtractionTableStudy, string>> = ({
    table,
    column,
}) => {
    const isSorted = column.getIsSorted();
    return (
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Tooltip title="Sort by doi" placement="top">
                <Typography
                    sx={{ ':hover': { cursor: 'pointer' } }}
                    underline="hover"
                    variant="h6"
                    component={Link}
                    onClick={() => {
                        if (!!isSorted) {
                            table.resetSorting();
                        } else {
                            table.setSorting([{ id: 'doi', desc: true }]);
                        }
                    }}
                >
                    DOI
                </Typography>
            </Tooltip>
            {!!isSorted && (
                <>
                    {isSorted === 'asc' ? (
                        <IconButton
                            size="small"
                            onClick={() => table.setSorting([{ id: 'doi', desc: true }])}
                        >
                            <ArrowUpwardIcon />
                        </IconButton>
                    ) : (
                        <IconButton
                            size="small"
                            onClick={() => table.setSorting([{ id: 'doi', desc: false }])}
                        >
                            <ArrowDownward />
                        </IconButton>
                    )}
                </>
            )}
        </Box>
    );
};
