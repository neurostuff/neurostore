import { Box, Button, Collapse, Paper, Stack, Typography } from '@mui/material';
import { useState, type ReactNode } from 'react';

/** One step of the page: an elevated card with a numbered badge, the title and one line
 * of what to do. An optional card starts folded; its button opens it smoothly. */
export function StepCard({
    step,
    title,
    subtitle,
    optional,
    children,
}: {
    step?: number;
    title: string;
    subtitle?: string;
    optional?: boolean;
    children: ReactNode;
}) {
    const [open, setOpen] = useState(!optional);
    return (
        <Paper elevation={2} sx={{ p: { xs: 2.5, sm: 4 }, borderRadius: 2 }}>
            <Stack direction="row" spacing={2} alignItems="center">
                {step !== undefined && (
                    <Box
                        aria-hidden
                        sx={{
                            width: 32,
                            height: 32,
                            flexShrink: 0,
                            borderRadius: 1,
                            bgcolor: 'primary.main',
                            color: 'primary.contrastText',
                            display: 'grid',
                            placeItems: 'center',
                            fontWeight: 600,
                            fontSize: 14,
                        }}
                    >
                        {step}
                    </Box>
                )}
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Typography variant="h6" component="h2" sx={{ fontWeight: 600, lineHeight: 1.3 }}>
                        {title}
                    </Typography>
                    {subtitle && (
                        <Typography variant="body2" color="text.secondary">
                            {subtitle}
                        </Typography>
                    )}
                </Box>
                {optional && (
                    <Button size="small" aria-expanded={open} onClick={() => setOpen(!open)}>
                        {open ? 'Hide' : 'Edit'}
                    </Button>
                )}
            </Stack>
            <Collapse in={open} timeout="auto">
                <Box sx={{ pt: 3 }}>{children}</Box>
            </Collapse>
        </Paper>
    );
}
