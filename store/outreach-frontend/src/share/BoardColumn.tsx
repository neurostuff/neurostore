import { Box, Paper, Typography } from '@mui/material';
import type { ReactNode } from 'react';

/** One of the board's two columns: a grey header over a full-width list. Both columns
 * share this so they come out the same width and look alike. ``flush`` drops the padding
 * around the list so its items run edge to edge; ``action`` sits at the header's right.
 *
 * ``fill`` (side by side, from md up) makes the column at least the screen's height, and as
 * tall as its sibling when that is taller, with a list inside that scrolls to fit. Its
 * content is laid out absolutely so it adds nothing to the row's height: a long list scrolls
 * instead of stretching the page. Stacked, it is an ordinary column. */
export function BoardColumn({
    id,
    title,
    action,
    flush = false,
    fill = false,
    children,
}: {
    id: string;
    title: string;
    action?: ReactNode;
    flush?: boolean;
    fill?: boolean;
    children: ReactNode;
}) {
    return (
        <Paper
            variant="outlined"
            component="section"
            aria-labelledby={id}
            sx={{
                flex: 1,
                minWidth: 0,
                width: '100%',
                overflow: 'hidden',
                ...(fill ? { position: 'relative', alignSelf: { md: 'stretch' }, minHeight: { md: '100vh' } } : {}),
            }}
        >
            <Box
                sx={
                    fill
                        ? { display: 'flex', flexDirection: 'column', position: { md: 'absolute' }, inset: { md: 0 } }
                        : undefined
                }
            >
                <Box
                    sx={{
                        px: 1.5,
                        py: 1,
                        bgcolor: 'primary.main',
                        borderBottom: 1,
                        borderColor: 'divider',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 1,
                        color: "primary.contrastText"
                    }}
                >
                    <Typography id={id} variant="subtitle1" component="h3" sx={{ fontWeight: 600 }}>
                        {title}
                    </Typography>
                    {action}
                </Box>
                <Box
                    sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        ...(flush ? {} : { p: 1.5, gap: 1 }),
                        ...(fill ? { flex: { md: '1 1 auto' }, minHeight: { md: 0 } } : {}),
                    }}
                >
                    {children}
                </Box>
            </Box>
        </Paper>
    );
}
