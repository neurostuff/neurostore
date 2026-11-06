import { alpha, type Theme } from '@mui/material/styles';

/** How a chip on a card looks: a rounded outline around its words. */
export const chipStyle = (theme: Theme) => ({
    typography: 'body2',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 0.5,
    px: 1,
    py: 0.125,
    border: `1px solid ${alpha(theme.palette.primary.main, 0.5)}`,
    borderRadius: 3,
    bgcolor: 'transparent',
    color: 'text.primary',
    cursor: 'pointer',
});

/** How a holder draws its open buttons (`.rv-open`, dotted chips) and its text toggles (`.rv-fold-toggle`). */
export const openStyles = (theme: Theme) => ({
    '& .rv-open': { ...chipStyle(theme), color: 'primary.main', borderStyle: 'dotted' },
    '& .rv-fold-toggle': {
        typography: 'body2',
        color: 'primary.main',
        background: 'none',
        border: 0,
        p: 0,
        cursor: 'pointer',
        textAlign: 'start',
    },
});

/** A button that opens an entity, or a field of one, elsewhere: its name, then an arrow unless `arrow` is false. */
export function OpenButton({
    name,
    title,
    onOpen,
    label = `open ${name}`,
    arrow = true,
}: {
    name: string;
    title: string;
    onOpen(): void;
    /** Its accessible name, `open <name>` by default. */
    label?: string;
    arrow?: boolean;
}) {
    return (
        <button
            type="button"
            className="rv-open"
            aria-label={label}
            title={title}
            onClick={(event) => {
                event.stopPropagation();
                onOpen();
            }}
        >
            {arrow ? `${name} →` : name}
        </button>
    );
}
