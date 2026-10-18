import { Box, Typography } from '@mui/material';
import type { Theme } from '@mui/material/styles';
import type { ReactNode } from 'react';
import { statusColors } from './status';
import { quickButtons } from '../review/quickButtons';

const headStyles = (theme: Theme) => ({
    px: 2,
    pt: 2,
    pb: 1,
    borderBottom: 1,
    borderColor: 'divider',
    ...statusColors(theme.palette),
    ...quickButtons(theme),
});

/** The head of a card: its overline and title, then whatever else the head holds. */
export function CardHead({
    overline,
    title,
    titleTooltip,
    heading,
    children,
}: {
    overline: string;
    title: string;
    /** Shown on hovering the title: the local id of an entity. */
    titleTooltip?: string;
    /** Rendered in place of the title's heading. */
    heading?: ReactNode;
    children?: ReactNode;
}) {
    return (
        <Box sx={headStyles}>
            <Typography variant="overline" color="primary" component="div">
                {overline}
            </Typography>
            {heading ?? (
                <Typography variant="h6" component="h2" title={titleTooltip}>
                    {title}
                </Typography>
            )}
            {children}
        </Box>
    );
}
