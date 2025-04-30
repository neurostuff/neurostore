import { Box, Typography } from '@mui/material';
import { CellContext, HeaderContext } from '@tanstack/react-table';
import { getAuthorsShortName } from 'helpers/utils';
import { ICurationTableStudy } from '../hooks/useCuratorTableState.types';

export const CuratorTableSummaryCell: React.FC<CellContext<ICurationTableStudy, unknown>> = (props) => {
    const row = props.row.original;
    const authorsShortened = getAuthorsShortName(row.authors);
    return (
        <Box>
            <Typography sx={{ fontSize: '12px', fontWeight: 'bold', lineHeight: 1.4 }}>
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
                sx={{ height: '31.59px', display: 'flex', alignItems: 'center', padding: '0 6px' }}
            >
                Study
            </Typography>
        </Box>
    );
};
