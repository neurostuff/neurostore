import { Box, Typography } from '@mui/material';
import { CellContext, HeaderContext } from '@tanstack/react-table';
import { getAuthorsShortName } from 'helpers/utils';
import { ICurationTableStudy } from '../hooks/useCuratorTableState';

export const CuratorTableSummaryCell: React.FC<CellContext<ICurationTableStudy, unknown>> = (props) => {
    const row = props.row.original;
    const authorsShortened = getAuthorsShortName(row.authors);
    return (
        <Box>
            <Typography sx={{ fontSize: '12px', fontWeight: 'bold' }}>
                {row.articleYear && <>({row.articleYear}).</>} {row.title}
            </Typography>
            <Typography sx={{ fontSize: '12px' }} color="black">
                {authorsShortened}
            </Typography>
            <Typography sx={{ fontSize: '12px' }} color="gray">
                {row.journal}
            </Typography>
        </Box>
    );
};

export const CuratorTableSummaryHeader: React.FC<HeaderContext<ICurationTableStudy, unknown>> = () => {
    return (
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Typography
                variant="body2"
                sx={{ marginRight: '4px', height: '31.59px', display: 'flex', alignItems: 'center' }}
            >
                Study
            </Typography>
        </Box>
    );
};
