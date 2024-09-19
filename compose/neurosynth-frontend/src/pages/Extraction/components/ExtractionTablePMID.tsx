import { Box, IconButton, Link, Tooltip, Typography } from '@mui/material';
import { CellContext, HeaderContext } from '@tanstack/react-table';
import { IExtractionTableStudy } from './ExtractionTable';
import { ArrowDownward } from '@mui/icons-material';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';

export const ExtractionTablePMIDCell: React.FC<CellContext<IExtractionTableStudy, string>> = (
    props
) => {
    const value = props.getValue();
    return <Typography variant="body2">{value}</Typography>;
};

export const ExtractionTablePMIDHeader: React.FC<HeaderContext<IExtractionTableStudy, string>> = ({
    column,
    table,
}) => {
    const isSorted = column.getIsSorted();
    return (
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Tooltip title="Sort by pmid" placement="top">
                <Typography
                    sx={{ ':hover': { cursor: 'pointer' } }}
                    underline="hover"
                    variant="h6"
                    component={Link}
                    onClick={() => {
                        if (!!isSorted) {
                            table.resetSorting();
                        } else {
                            table.setSorting([{ id: 'pmid', desc: true }]);
                        }
                    }}
                >
                    PMID
                </Typography>
            </Tooltip>
            {!!isSorted && (
                <>
                    {isSorted === 'asc' ? (
                        <IconButton
                            size="small"
                            onClick={() => table.setSorting([{ id: 'pmid', desc: true }])}
                        >
                            <ArrowUpwardIcon />
                        </IconButton>
                    ) : (
                        <IconButton
                            size="small"
                            onClick={() => table.setSorting([{ id: 'pmid', desc: false }])}
                        >
                            <ArrowDownward />
                        </IconButton>
                    )}
                </>
            )}
        </Box>
    );
};
