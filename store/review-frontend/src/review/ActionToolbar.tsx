import { Button, Stack, Tooltip } from '@mui/material';
import { useIsEditable, useReviewStores, useSessionView } from '../store/context';
import { keyLabel, type Scope, SHORTCUTS, type Shortcut } from './shortcuts';

type Labelled = Shortcut & { button: NonNullable<Shortcut['button']> };

const SEPARATOR = '\u0000';

/**
 * One button per shortcut in `scope` that has a label, in table order; each runs its shortcut. A button whose
 * shortcut does not apply to the focus is disabled, its tooltip saying why; otherwise the tooltip names its key.
 */
export function ActionToolbar({ scope, label }: { scope: Scope; label: string }) {
    const stores = useReviewStores();
    const editable = useIsEditable();
    const actions = SHORTCUTS.filter((s): s is Labelled => s.scope === scope && s.button !== undefined);
    const reasons = useSessionView((session, view) =>
        actions.map((action) => action.unavailable?.(session, view) ?? '').join(SEPARATOR)
    ).split(SEPARATOR);
    return (
        <Stack
            role="toolbar"
            aria-label={label}
            direction="row"
            spacing={1}
            useFlexGap
            flexWrap="wrap"
            sx={{ px: 2, pt: 1 }}
        >
            {actions.map(({ keys, label: description, button, run }, i) => (
                <Tooltip key={button.label} title={reasons[i] || `${description} (${keyLabel(keys[0])})`}>
                    <span>
                        <Button
                            size="small"
                            variant="outlined"
                            color={button.color ?? 'primary'}
                            aria-keyshortcuts={keyLabel(keys[0])}
                            disabled={!editable || reasons[i] !== ''}
                            onClick={() => run(stores)}
                        >
                            {button.label}
                        </Button>
                    </span>
                </Tooltip>
            ))}
        </Stack>
    );
}
