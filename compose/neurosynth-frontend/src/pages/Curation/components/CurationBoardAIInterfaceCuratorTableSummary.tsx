import { Box, Typography } from '@mui/material';
import { CellContext, HeaderContext } from '@tanstack/react-table';
import { ICurationTableStudy } from './CurationBoardAIInterfaceCuratorTable';
import { getAuthorsShortName } from 'helpers/utils';

export const CuratorTableSummaryCell: React.FC<CellContext<ICurationTableStudy, unknown>> = (props) => {
    const row = props.row.original;
    const authorsShortened = getAuthorsShortName(row.authors);
    return (
        <Box>
            <Typography sx={{ fontSize: '10px', fontWeight: 'bold' }}>
                {row.articleYear && <>({row.articleYear}).</>} {row.title}
            </Typography>
            <Typography sx={{ fontSize: '10px' }}>{authorsShortened}</Typography>
            <Typography sx={{ fontSize: '10px' }} color="muted.main">
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
