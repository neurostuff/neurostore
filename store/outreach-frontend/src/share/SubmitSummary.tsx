import { Box, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { summary } from './grouping';
import type { ShareView } from './types';

const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);

// A line is yellow while something is still open and green once it is done. MUI's warning colour is
// orange, and a bright yellow is unreadable on this pale panel, so the yellow is a dark gold (4.9:1).
const OPEN = '#8a6500';
const DONE = 'success.main';

/** What is about to be sent, in two lines. Each line is yellow while something is still open (maps on no
 * analysis, analyses with no map) and green once nothing is. */
export function SubmitSummary({ view }: { view: ShareView }) {
    const { uploaded, unassigned, filled, empty } = summary(view);
    const total = filled + empty;
    const assigned = uploaded - unassigned;
    const rows: { count: number; text: string; open: boolean }[] = [
        {
            count: assigned,
            text: `${plural(assigned, 'map', 'maps')} assigned of ${uploaded} uploaded`,
            open: unassigned > 0,
        },
        {
            count: filled,
            text: `${plural(filled, 'analysis has maps', 'analyses have maps')} out of ${total} total ${plural(total, 'analysis', 'analyses')}`,
            open: empty > 0,
        },
    ];
    return (
        <Box
            component="section"
            aria-label="Summary"
            sx={{ p: 2, borderRadius: 1, bgcolor: (theme) => alpha(theme.palette.primary.main, 0.06) }}
        >
            <Typography variant="overline" color="text.secondary" component="h3" sx={{ lineHeight: 1.5 }}>
                Summary
            </Typography>
            <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                {rows.map(({ count, text, open }) => (
                    <Stack
                        key={text}
                        direction="row"
                        spacing={1.5}
                        alignItems="baseline"
                        sx={{ color: open ? OPEN : DONE }}
                    >
                        <Typography
                            component="span"
                            variant="h6"
                            sx={{ minWidth: 32, textAlign: 'right', fontWeight: 700, color: 'inherit' }}
                        >
                            {count}
                        </Typography>
                        <Typography component="span" variant="body1" sx={{ color: 'inherit' }}>
                            {text}
                        </Typography>
                    </Stack>
                ))}
            </Stack>
        </Box>
    );
}
