import type { Theme } from '@mui/material/styles';
import { statusColors } from './status';

/** The rows of a card's fields, the focused one marked. */
export const slotStyles = (theme: Theme) => ({
    '& .rv-slot': {
        px: 2,
        py: 0.75,
        cursor: 'pointer',
        borderLeft: 3,
        borderColor: 'transparent',
        '&:hover': { bgcolor: 'action.hover' },
    },
    '& .rv-slot[aria-current="true"]': { borderColor: 'primary.main', bgcolor: 'action.selected' },
    '& .rv-slot-head': { typography: 'caption', display: 'flex', gap: 1.5 },
    '& .rv-slot-label': { color: 'text.secondary', fontWeight: 500 },
    '& .rv-slot-value': { typography: 'body2', overflowWrap: 'anywhere' },
    '& .rv-values': { m: 0, pl: 2.5 },
    ...statusColors(theme.palette),
});
