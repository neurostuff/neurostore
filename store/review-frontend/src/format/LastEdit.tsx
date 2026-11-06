import { Box } from '@mui/material';
import { editSummary } from './editSummary';

export function LastEdit({ opCount, lastEditAt, now }: { opCount: number; lastEditAt: string; now: Date }) {
    return (
        <Box component="span" sx={{ display: 'block' }} title={new Date(lastEditAt).toLocaleString()}>
            {editSummary(opCount, lastEditAt, now)}
        </Box>
    );
}
