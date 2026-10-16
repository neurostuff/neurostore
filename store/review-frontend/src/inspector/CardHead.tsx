import { Box, Typography } from '@mui/material';
import type { Theme } from '@mui/material/styles';
import type { ReactNode } from 'react';
import { statusColors } from './status';

const headStyles = (theme: Theme) => ({
    px: 2,
    pt: 2,
    pb: 1,
    borderBottom: 1,
    borderColor: 'divider',
    ...statusColors(theme.palette),
});

/** The head of a card: its overline and title, then whatever else the head holds. */
export function CardHead({ overline, title, children }: { overline: string; title: string; children?: ReactNode }) {
    return (
        <Box sx={headStyles}>
            <Typography variant="overline" color="primary" component="div">
                {overline}
            </Typography>
            <Typography variant="h6" component="h2">
                {title}
            </Typography>
            {children}
        </Box>
    );
}
