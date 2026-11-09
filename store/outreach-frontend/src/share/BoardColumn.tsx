import { Box, Paper, Typography } from '@mui/material';
import type { ReactNode } from 'react';

/** One of the board's two columns: a grey header over a full-width list. Both columns
 * share this so they come out the same width and look alike. ``flush`` drops the padding
 * around the list so its items run edge to edge; ``action`` sits at the header's right. */
export function BoardColumn({
    id,
    title,
    action,
    flush = false,
    children,
}: {
    id: string;
    title: string;
    action?: ReactNode;
    flush?: boolean;
    children: ReactNode;
}) {
    return (
        <Paper
            variant="outlined"
            component="section"
            aria-labelledby={id}
            sx={{ flex: 1, minWidth: 0, width: '100%', overflow: 'hidden' }}
        >
            <Box
                sx={{
                    px: 1.5,
                    py: 1,
                    bgcolor: 'grey.300',
                    borderBottom: 1,
                    borderColor: 'divider',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 1,
                }}
            >
                <Typography id={id} variant="subtitle1" component="h3" sx={{ fontWeight: 600 }}>
                    {title}
                </Typography>
                {action}
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', ...(flush ? {} : { p: 1.5, gap: 1 }) }}>
                {children}
            </Box>
        </Paper>
    );
}
