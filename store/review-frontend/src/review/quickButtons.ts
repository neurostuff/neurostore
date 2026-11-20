import { alpha, type Theme } from '@mui/material/styles';

/** How a holder of quick buttons draws them: as MUI's small outlined buttons look. */
export const quickButtons = (theme: Theme) => ({
    '& .rv-quick': {
        ...theme.typography.button,
        fontSize: '0.75rem',
        lineHeight: 1.5,
        padding: '2px 8px',
        borderRadius: theme.shape.borderRadius,
        border: `1px solid ${alpha(theme.palette.primary.main, 0.5)}`,
        color: theme.palette.primary.main,
        background: 'transparent',
        cursor: 'pointer',
        '&:hover': { background: alpha(theme.palette.primary.main, 0.08) },
        '&:focus-visible': { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 1 },
        '&[data-color="error"]': {
            color: theme.palette.error.main,
            borderColor: alpha(theme.palette.error.main, 0.5),
        },
        '&:disabled': {
            color: theme.palette.text.disabled,
            borderColor: theme.palette.action.disabledBackground,
            cursor: 'default',
        },
    },
});
