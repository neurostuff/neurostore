import { Button, Stack } from '@mui/material';
import { memo } from 'react';
import { entityKey } from '../model/targetKey';
import { useIsEditable, useReviewStores, useSessionView } from '../store/context';
import { Hint } from './Hint';
import { quickButtons } from './quickButtons';
import { keyLabel, type Scope, SHORTCUTS, type Shortcut } from './shortcuts';

type Labelled = Shortcut & { button: NonNullable<Shortcut['button']> };

const SEPARATOR = '\u0000';

const hasButton = (s: Shortcut): s is Labelled => s.button !== undefined;

/** Why each action does not apply now, in order, to the focus or to the entity `entity` as if focused; '' for one that does. */
function useReasons(actions: Labelled[], entity?: string): string[] {
    return useSessionView((session, view) => {
        const on = entity === undefined ? view : { ...view, focus: { entity, key: entityKey(entity) } };
        return actions.map((action) => action.unavailable?.(session, on) ?? '').join(SEPARATOR);
    }).split(SEPARATOR);
}

/** What a shortcut's button says on hover: why it does not apply, or what it does and its key. */
const hintOf = ({ keys, label }: Labelled, reason: string) => reason || `${label} (${keyLabel(keys[0])})`;

/** What a shortcut's button does: it runs the shortcut, and is disabled while `reason` says it does not apply. */
function useActionProps({ keys, run }: Labelled, reason: string) {
    const stores = useReviewStores();
    const editable = useIsEditable();
    return {
        'aria-keyshortcuts': keyLabel(keys[0]),
        disabled: !editable || reason !== '',
        onClick: () => run(stores),
    };
}

/** The button that runs a shortcut, disabled while `reason` says it does not apply. */
const ActionButton = memo(function ActionButton({ action, reason }: { action: Labelled; reason: string }) {
    const { button } = action;
    const props = useActionProps(action, reason);
    return (
        <Button size="small" variant="outlined" color={button.color ?? 'primary'} {...props}>
            {button.label}
        </Button>
    );
});

/** A shortcut's button with its hint in a tooltip, for a toolbar mounted once. */
const ShortcutButton = memo(function ShortcutButton({ action, reason }: { action: Labelled; reason: string }) {
    return (
        <Hint title={hintOf(action, reason)}>
            <span>
                <ActionButton action={action} reason={reason} />
            </span>
        </Hint>
    );
});

/**
 * A shortcut's plain button with its hint as the browser's own, for buttons mounted at each focus, where a tooltip
 * and a ripple cost; its look is the `quickButtons` styles of whatever holds it.
 */
function QuickButton({ action, reason }: { action: Labelled; reason: string }) {
    const { button } = action;
    const props = useActionProps(action, reason);
    return (
        <button
            type="button"
            className="rv-quick"
            data-color={button.color ?? 'primary'}
            title={hintOf(action, reason)}
            {...props}
        >
            {button.label}
        </button>
    );
}

const RECORD_FIELD = SHORTCUTS.filter((s): s is Labelled => s.scope === 'record' && s.field === true && hasButton(s));

/**
 * One button per shortcut in `scope` that has a label, in table order; each runs its shortcut. A button whose
 * shortcut does not apply to the focus is disabled, its tooltip saying why; otherwise the tooltip names its key.
 */
export function ActionToolbar({ scope, label }: { scope: Scope; label: string }) {
    const actions = SHORTCUTS.filter((s): s is Labelled => s.scope === scope && hasButton(s));
    const reasons = useReasons(actions);
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
            {actions.map((action, i) => (
                <ShortcutButton key={action.button.label} action={action} reason={reasons[i]} />
            ))}
        </Stack>
    );
}

/** The actions on the focused field that apply to it, beside it (D97); a click on one stays with the field. */
export function FieldActions({ label }: { label: string }) {
    const reasons = useReasons(RECORD_FIELD);
    return (
        <Stack
            role="toolbar"
            aria-label={`actions on ${label}`}
            direction="row"
            spacing={0.5}
            useFlexGap
            flexWrap="wrap"
            sx={(theme) => ({ pt: 0.5, ...quickButtons(theme) })}
            onClick={(event) => event.stopPropagation()}
            onDoubleClick={(event) => event.stopPropagation()}
        >
            {RECORD_FIELD.map((action, i) =>
                reasons[i] === '' ? <QuickButton key={action.button.label} action={action} reason="" /> : null
            )}
        </Stack>
    );
}

type OnCard = Labelled & { card: NonNullable<Shortcut['card']> };

const RECORD_CARD = SHORTCUTS.filter((s): s is OnCard => s.scope === 'record' && s.card !== undefined && hasButton(s));

/** A card action as its button runs it: on the entity, focusing it first where the shortcut asks to. */
const onEntity = (action: OnCard, entity: string, kind: string): Labelled => ({
    ...action,
    button: { ...action.button, label: action.card.label(kind) },
    run: (stores) => {
        const view = stores.view.getState();
        if (action.card.focusesEntity && view.focus.key !== entityKey(entity)) view.focusEntity(entity);
        action.run(stores);
    },
});

/** The actions on the focused card's entity, on its head, each named for the entity's kind. */
export const CardActions = memo(function CardActions({ entity, kind }: { entity: string; kind: string }) {
    const reasons = useReasons(RECORD_CARD, entity);
    return RECORD_CARD.map((action, i) => (
        <QuickButton key={action.button.label} action={onEntity(action, entity, kind)} reason={reasons[i]} />
    ));
});
