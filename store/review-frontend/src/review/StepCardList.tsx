import { Box, List, ListItem, ListItemButton, ListItemText, Stack, Typography } from '@mui/material';
import type { Theme } from '@mui/material/styles';
import type { ReactNode } from 'react';
import { InspectorFrame } from '../inspector/Inspector';
import { statusColors } from '../inspector/status';
import type { StepId } from '../model/steps';
import { useSession, useView } from '../store/context';
import { cardStyles, fieldPanelStyles } from './cardStyles';
import { Hint } from './Hint';
import { quickButtons } from './quickButtons';
import { selectStepProgress } from './stepCount';

/** A guided step's cards: its heading with the step's count, `aside`, then the cards, or `empty` where there are none. */
export function StepCardList({
    step,
    label,
    heading = label,
    empty,
    aside,
    children,
}: {
    step: StepId;
    /** The list's accessible name. */
    label: string;
    heading?: string;
    /** What the step says in place of the list while it has no card. */
    empty?: string;
    aside?: ReactNode;
    children: ReactNode;
}) {
    const done = useSession((s) => selectStepProgress(s, step).text);
    return (
        <InspectorFrame>
            <Typography variant="overline" component="h2" sx={{ px: 2, display: 'block' }}>
                {`${heading} · ${done} done`}
            </Typography>
            {aside}
            {empty !== undefined ? (
                <Typography variant="body2" color="text.secondary" sx={{ px: 2 }}>
                    {empty}
                </Typography>
            ) : (
                <List dense disablePadding aria-label={label}>
                    {children}
                </List>
            )}
        </InspectorFrame>
    );
}

const headStyles = (theme: Theme) => ({
    pr: 1.5,
    ...statusColors(theme.palette),
    ...quickButtons(theme),
    '& .rv-quick': { whiteSpace: 'nowrap' },
});

const openHeadStyles = { bgcolor: 'action.selected' } as const;

/**
 * A card of a guided step: a head naming the entity `id`, with `secondary` under its name and `actions` beside it, a
 * click on it opening the card; while open, `children` in a region named `region`.
 */
export function StepCard({
    id,
    name,
    secondary,
    actions,
    open,
    region,
    children,
}: {
    id: string;
    name: string;
    secondary: ReactNode;
    actions?: ReactNode;
    open: boolean;
    region: string;
    children?: ReactNode;
}) {
    const focusEntity = useView((s) => s.focusEntity);
    return (
        <ListItem disablePadding sx={cardStyles}>
            <Stack direction="row" alignItems="center" spacing={1} sx={[headStyles, open && openHeadStyles]}>
                <Hint title={`Open ${name} (Shift+J and Shift+K move between cards)`}>
                    <ListItemButton
                        data-card={id}
                        aria-current={open ? 'true' : undefined}
                        onClick={() => focusEntity(id)}
                        sx={{ flex: '1 1 auto', minWidth: 0 }}
                    >
                        <ListItemText
                            primary={name}
                            primaryTypographyProps={{ variant: 'subtitle1', component: 'div', fontWeight: 600 }}
                            secondary={secondary}
                            secondaryTypographyProps={{ component: 'div' }}
                        />
                    </ListItemButton>
                </Hint>
                {actions}
            </Stack>
            {open && (
                <Box role="region" aria-label={region} sx={fieldPanelStyles}>
                    {children}
                </Box>
            )}
        </ListItem>
    );
}
