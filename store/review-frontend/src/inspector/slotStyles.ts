import type { Theme } from '@mui/material/styles';
import { statusColors } from './status';

/** A field's head, its About line and value, as a row, the comparison and the selection's details show them. */
export const slotHeadStyles = {
    '& .rv-slot-head': { typography: 'caption', display: 'flex', flexWrap: 'wrap', gap: 1.5 },
    '& .rv-slot-label': { color: 'text.secondary', fontWeight: 500 },
    '& .rv-slot-value': { typography: 'body2', overflowWrap: 'anywhere' },
    '& .rv-values': { m: 0, pl: 2.5 },
    '& .rv-field-about': { typography: 'caption', color: 'text.secondary', display: 'flex', gap: 0.5, minWidth: 0 },
    '& .rv-field-about-text': { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
    '& .rv-field-about[data-open] .rv-field-about-text': { whiteSpace: 'pre-line', overflowWrap: 'anywhere' },
    '& .rv-field-about-toggle': {
        font: 'inherit',
        color: 'primary.main',
        background: 'none',
        border: 0,
        p: 0,
        cursor: 'pointer',
        flexShrink: 0,
        alignSelf: 'flex-start',
    },
} as const;

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
    ...slotHeadStyles,
    ...statusColors(theme.palette),
});
