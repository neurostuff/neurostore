import { Box, Stack } from '@mui/material';
import type { Theme } from '@mui/material/styles';
import { memo, type ReactNode } from 'react';
import { entityKey } from '../model/targetKey';
import { useIsEditable, useReviewStores, useSessionView } from '../store/context';
import { quickButtons } from './quickButtons';
import { keyLabel, SHORTCUTS, type Shortcut } from './shortcuts';

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
function useActionProps({ keys, run, button }: Labelled, reason: string) {
    const stores = useReviewStores();
    const editable = useIsEditable();
    return {
        'aria-keyshortcuts': keyLabel(keys[0]),
        disabled: (!editable && !button.readOnly) || reason !== '',
        onClick: () => run(stores),
    };
}

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

/** How a row of quick buttons beside what they act on is laid out. */
const BESIDE = {
    direction: 'row',
    spacing: 0.5,
    useFlexGap: true,
    flexWrap: 'wrap',
    sx: (theme: Theme) => ({ pt: 0.5, ...quickButtons(theme) }),
} as const;

const RECORD_FIELD = SHORTCUTS.filter((s): s is Labelled => s.scope === 'record' && s.field === true && hasButton(s));

/** The actions on the focused field that apply to it, beside it (D97), then `children`; a click on one stays with the field. */
export function FieldActions({ label, children }: { label: string; children?: ReactNode }) {
    const reasons = useReasons(RECORD_FIELD);
    return (
        <Stack
            role="toolbar"
            aria-label={`actions on ${label}`}
            {...BESIDE}
            onClick={(event) => event.stopPropagation()}
            onDoubleClick={(event) => event.stopPropagation()}
        >
            {RECORD_FIELD.map((action, i) =>
                reasons[i] === '' ? <QuickButton key={action.button.label} action={action} reason="" /> : null
            )}
            {children}
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

const COORDINATE = SHORTCUTS.filter((s): s is Labelled => s.scope === 'coordinates' && hasButton(s));
const placed = (place: Shortcut['place']) => COORDINATE.filter((s) => s.place === place);
const STEPPING = placed('stepping');
const ON_ANALYSIS = placed('head');
const ON_POINTS = placed('points');

/** One quick button per action, disabled while it does not apply to the focus, its hint saying why. */
const QuickButtons = memo(function QuickButtons({ actions }: { actions: Labelled[] }) {
    const reasons = useReasons(actions);
    return actions.map((action, i) => <QuickButton key={action.button.label} action={action} reason={reasons[i]} />);
});

/** The buttons on the focused coordinate analysis's head: Previous and Next (Shift+K and Shift+J), then its actions. */
export const CoordinateHeadActions = () => (
    <>
        <QuickButtons actions={STEPPING} />
        <QuickButtons actions={ON_ANALYSIS} />
    </>
);

const EXPLAINED = ON_ANALYSIS.filter((s) => s.reasonOnHead);

/** Why those of the head's actions that say so do not apply, written out, as a hint shows only on hover. */
export const AnalysisReasons = memo(function AnalysisReasons() {
    const reasons = useReasons(EXPLAINED).filter(Boolean);
    if (!reasons.length) return null;
    return (
        <Box
            component="ul"
            aria-label="why some actions do not apply"
            sx={{ m: 0, p: 0, listStyle: 'none', typography: 'caption', color: 'text.secondary' }}
        >
            {reasons.map((reason) => (
                <li key={reason}>{reason}</li>
            ))}
        </Box>
    );
});

/**
 * The actions on the focused point, or the selected ones, beside the points, laid out as `FieldActions`. Unlike the
 * field's, they show disabled, their hints saying how to focus or select points, and they are a group, since the
 * Coordinates step has no toolbar; nothing around them takes a click.
 */
export function PointActions({ label }: { label: string }) {
    return (
        <Stack role="group" aria-label={`actions on ${label}`} {...BESIDE}>
            <QuickButtons actions={ON_POINTS} />
        </Stack>
    );
}
