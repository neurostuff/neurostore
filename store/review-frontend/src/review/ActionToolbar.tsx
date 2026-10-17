import { Button, Stack } from '@mui/material';
import { useIsEditable, useReviewStores } from '../store/context';
import { keyLabel, type Scope, SHORTCUTS, type Shortcut } from './shortcuts';

type Labelled = Shortcut & { button: NonNullable<Shortcut['button']> };

/** One button per shortcut in `scope` that has a label, in table order; each runs its shortcut. */
export function ActionToolbar({ scope, label }: { scope: Scope; label: string }) {
    const stores = useReviewStores();
    const editable = useIsEditable();
    const actions = SHORTCUTS.filter((s): s is Labelled => s.scope === scope && s.button !== undefined);
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
            {actions.map(({ keys, button, run }) => (
                <Button
                    key={button.label}
                    size="small"
                    variant="outlined"
                    color={button.color ?? 'primary'}
                    aria-keyshortcuts={keyLabel(keys[0])}
                    disabled={!editable}
                    onClick={() => run(stores)}
                >
                    {button.label}
                </Button>
            ))}
        </Stack>
    );
}
