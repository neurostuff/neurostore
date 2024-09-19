import { Box, IconButton, Link, Tooltip, Typography } from '@mui/material';
import { CellContext, HeaderContext } from '@tanstack/react-table';
import { IExtractionTableStudy } from './ExtractionTable';
import { ArrowDownward } from '@mui/icons-material';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';

export const ExtractionTableJournalCell: React.FC<CellContext<IExtractionTableStudy, string>> = (
    props
) => {
    const value = props.getValue();
    return <Typography variant="body2">{value}</Typography>;
};

export const ExtractionTableJournalHeader: React.FC<
    HeaderContext<IExtractionTableStudy, string>
> = ({ table, column }) => {
    const isSorted = column.getIsSorted();
    return (
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Tooltip title="Sort by journal" placement="top">
                <Typography
                    sx={{ ':hover': { cursor: 'pointer' } }}
                    underline="hover"
                    variant="h6"
                    component={Link}
                    onClick={() => {
                        if (!!isSorted) {
                            table.resetSorting();
                        } else {
                            table.setSorting([{ id: 'journal', desc: true }]);
                        }
                    }}
                >
                    Journal
                </Typography>
            </Tooltip>
            {!!isSorted && (
                <>
                    {isSorted === 'asc' ? (
                        <IconButton
                            size="small"
                            onClick={() => table.setSorting([{ id: 'journal', desc: true }])}
                        >
                            <ArrowUpwardIcon />
                        </IconButton>
                    ) : (
                        <IconButton
                            size="small"
                            onClick={() => table.setSorting([{ id: 'journal', desc: false }])}
                        >
                            <ArrowDownward />
                        </IconButton>
                    )}
                </>
            )}
        </Box>
    );
};
