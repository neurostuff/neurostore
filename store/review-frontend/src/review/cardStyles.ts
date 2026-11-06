/** A guided step's card: outlined, its border the primary colour while it holds the focus. */
export const cardStyles = {
    display: 'block',
    mx: 1.5,
    mb: 1,
    width: 'auto',
    border: 1,
    borderColor: 'divider',
    borderRadius: 1,
    '&:has([aria-current="true"])': { borderColor: 'primary.main' },
} as const;

/** The tinted region under the focused card's head, holding its fields. */
export const fieldPanelStyles = {
    ml: 1.5,
    mb: 1,
    borderLeft: 3,
    borderColor: 'primary.main',
    bgcolor: 'fieldSurface',
} as const;
