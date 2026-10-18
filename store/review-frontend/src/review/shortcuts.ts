import { useEffect } from 'react';
import { acceptAnalysis, addSelectionToAnalysis, editPoint, removePoint, splitAnalysis } from '../coordinates/actions';
import { COORDINATE_UNAVAILABLE as NOT, type CoordinateSession } from '../coordinates/availability';
import { RECORD_UNAVAILABLE as RECORD, type RecordSession } from '../inspector/availability';
import { accept, acceptCard, createOn } from '../inspector/actions';
import type { Reason } from './reason';
import type { ReviewStores } from '../store/reviewStores';
import type { ViewState } from '../store/viewStore';
import { addSelection } from '../text/addSelection';
import { openMoveEvidence, removeCursorSpan, stepCursorSpan } from '../text/spanEdits';
import { openPanelOn } from '../inspector/openPanel';

/** Where a shortcut acts: on a record item, on a coordinate analysis, or (unscoped) anywhere. */
export type Scope = 'record' | 'coordinates';

export interface Shortcut {
    keys: string[];
    label: string;
    scope?: Scope;
    /** The toolbar button that runs the shortcut, if it has one. */
    button?: { label: string; color?: 'error' };
    /** Whether its button is also beside the focused field, where it applies (D97). */
    field?: boolean;
    /** Whether its button sits on the focused card's head instead of the toolbar. */
    card?: boolean;
    /** Why the shortcut does not apply to the focus now; undefined when it does. */
    unavailable?: Reason<RecordSession & CoordinateSession, ViewState>;
    run(stores: ReviewStores): void;
}

/** The key as pressed: a letter is as written, a shifted one `Shift+` and its capital, a named key is as written, Space is spelt out. */
export const keyLabel = (key: string) => {
    if (key === ' ') return 'Space';
    if (key.length > 1) return key;
    return key !== key.toLowerCase() ? `Shift+${key}` : key;
};

const record = (shortcut: Omit<Shortcut, 'scope'>): Shortcut => ({ ...shortcut, scope: 'record' });
const coordinates = (shortcut: Omit<Shortcut, 'scope'>): Shortcut => ({ ...shortcut, scope: 'coordinates' });

const view = (stores: ReviewStores) => stores.view.getState();
const session = (stores: ReviewStores) => stores.session.getState();

/** Runs `normal`, or, while the diff is shown, steps to the next or previous change. */
const diffAware = (normal: (s: ReviewStores) => void, delta: 1 | -1) => (s: ReviewStores) =>
    view(s).diffOn ? view(s).moveChange(delta) : normal(s);

export const SHORTCUTS: Shortcut[] = [
    record({
        keys: ['j'],
        label: 'next slot; next change while the diff is shown',
        run: diffAware((s) => view(s).moveSlot(1), 1),
    }),
    record({
        keys: ['k'],
        label: 'previous slot; previous change while the diff is shown',
        run: diffAware((s) => view(s).moveSlot(-1), -1),
    }),
    record({ keys: ['Shift+J'], label: 'next entity', run: (s) => view(s).moveEntity(1) }),
    record({ keys: ['Shift+K'], label: 'previous entity', run: (s) => view(s).moveEntity(-1) }),
    { keys: [']'], label: 'next evidence span', run: (s) => view(s).stepEvidence(1) },
    { keys: ['['], label: 'previous evidence span', run: (s) => view(s).stepEvidence(-1) },
    record({ keys: ['e'], label: 'add the selection to the slot’s evidence', run: (s) => addSelection(s, 'first') }),
    record({ keys: ['Shift+E'], label: 'add the selection as a new evidence set', run: (s) => addSelection(s, 'new') }),
    record({
        keys: [','],
        label: 'move the focused evidence span’s end a word back',
        run: (s) => stepCursorSpan(s, 'end', -1),
    }),
    record({
        keys: ['.'],
        label: 'move the focused evidence span’s end a word on',
        run: (s) => stepCursorSpan(s, 'end', 1),
    }),
    record({
        keys: ['<'],
        label: 'move the focused evidence span’s start a word back',
        run: (s) => stepCursorSpan(s, 'start', -1),
    }),
    record({
        keys: ['>'],
        label: 'move the focused evidence span’s start a word on',
        run: (s) => stepCursorSpan(s, 'start', 1),
    }),
    record({ keys: ['Backspace'], label: 'remove the focused evidence span', run: removeCursorSpan }),
    record({
        keys: ['a'],
        label: 'accept the focused slot, entity or link',
        button: { label: 'Accept' },
        field: true,
        unavailable: RECORD.judge,
        run: (s) => void accept(s),
    }),
    record({
        keys: ['Shift+A'],
        label: 'accept every untouched slot on the card that has evidence',
        button: { label: 'Accept all with evidence' },
        card: true,
        unavailable: RECORD.acceptCard,
        run: (s) => void acceptCard(s),
    }),
    record({
        keys: ['r'],
        label: 'reject, with a reason (1–5) and an optional note',
        button: { label: 'Reject', color: 'error' },
        field: true,
        unavailable: RECORD.judge,
        run: (s) => openPanelOn(s, 'reject'),
    }),
    record({
        keys: ['Enter'],
        label: 'edit the focused value; Enter saves, Esc cancels',
        button: { label: 'Edit' },
        field: true,
        unavailable: RECORD.edit,
        run: (s) => openPanelOn(s, 'edit'),
    }),
    record({
        keys: ['n'],
        label: 'mark the focused slot not reported, with its reason',
        button: { label: 'Not reported' },
        unavailable: RECORD.notReported,
        run: (s) => openPanelOn(s, 'not_reported'),
    }),
    record({
        keys: ['l'],
        label: 'link the focused reference slot to an entity',
        button: { label: 'Link' },
        field: true,
        unavailable: RECORD.link,
        run: (s) => openPanelOn(s, 'link'),
    }),
    record({
        keys: ['c'],
        label: 'create an entity in the focused entity’s list; asks which class where the list has several',
        button: { label: 'New entity' },
        unavailable: RECORD.create,
        run: (s) => createOn(s),
    }),
    record({
        keys: ['Shift+Backspace'],
        label: 'delete the focused entity, after confirming',
        button: { label: 'Delete', color: 'error' },
        unavailable: RECORD.delete,
        run: (s) => openPanelOn(s, 'delete'),
    }),
    record({
        keys: [';'],
        label: 'add a note to the focused item',
        button: { label: 'Note' },
        field: true,
        unavailable: RECORD.judge,
        run: (s) => openPanelOn(s, 'note'),
    }),
    record({
        keys: ['m'],
        label: 'move the focused evidence span to another field',
        button: { label: 'Move to…' },
        field: true,
        unavailable: RECORD.moveEvidence,
        run: openMoveEvidence,
    }),
    coordinates({
        keys: ['j'],
        label: 'next point; next change while the diff is shown',
        run: diffAware((s) => view(s).movePoint(1), 1),
    }),
    coordinates({
        keys: ['k'],
        label: 'previous point, from the first back to the analysis; previous change while the diff is shown',
        run: diffAware((s) => view(s).movePoint(-1), -1),
    }),
    coordinates({ keys: ['Shift+J'], label: 'next analysis', run: (s) => view(s).moveAnalysis(1) }),
    coordinates({ keys: ['Shift+K'], label: 'previous analysis', run: (s) => view(s).moveAnalysis(-1) }),
    coordinates({
        keys: ['e'],
        label: 'add the selection to the evidence of the record Analysis naming the focused analysis',
        run: (s) => void addSelectionToAnalysis(s),
    }),
    coordinates({
        keys: ['a'],
        label: 'accept the focused analysis',
        button: { label: 'Accept' },
        unavailable: NOT.judge,
        run: (s) => void acceptAnalysis(s),
    }),
    coordinates({
        keys: ['Shift+Backspace'],
        label: 'reject the focused analysis: with a reason (1–5) and an optional note',
        button: { label: 'Reject', color: 'error' },
        unavailable: NOT.judge,
        run: (s) => openPanelOn(s, 'reject'),
    }),
    coordinates({
        keys: [';'],
        label: 'add a note to the focused analysis',
        button: { label: 'Note' },
        unavailable: NOT.note,
        run: (s) => openPanelOn(s, 'note'),
    }),
    coordinates({
        keys: ['n'],
        label: 'edit the focused analysis: its name, coordinate space and role',
        button: { label: 'Edit analysis' },
        unavailable: NOT.judge,
        run: (s) => openPanelOn(s, 'edit_analysis'),
    }),
    coordinates({
        keys: ['r'],
        label: 'change the focused analysis’s role',
        button: { label: 'Change role' },
        unavailable: NOT.judge,
        run: (s) => openPanelOn(s, 'relabel'),
    }),
    coordinates({
        keys: ['Enter'],
        label: 'edit the points in the grid, from the focused point or the first',
        button: { label: 'Edit point' },
        unavailable: NOT.editPoint,
        run: (s) => void editPoint(s),
    }),
    coordinates({
        keys: [' '],
        label: 'select or unselect the focused point; on the analysis, select it for a merge',
        run: (s) => view(s).togglePoint(),
    }),
    coordinates({
        keys: ['Backspace'],
        label: 'remove the focused point',
        run: (s) => void removePoint(s),
    }),
    coordinates({
        keys: ['m'],
        label: 'move the selected points, or the focused one, to another analysis',
        button: { label: 'Move' },
        unavailable: NOT.move,
        run: (s) => openPanelOn(s, 'move'),
    }),
    coordinates({
        keys: ['s'],
        label: 'split the focused analysis: the selected points, then the rest',
        button: { label: 'Split' },
        unavailable: NOT.split,
        run: (s) => void splitAnalysis(s),
    }),
    coordinates({
        keys: ['g'],
        label: 'merge the analyses selected for a merge with the focused one, after confirming',
        button: { label: 'Merge' },
        unavailable: NOT.merge,
        run: (s) => openPanelOn(s, 'merge'),
    }),
    coordinates({
        keys: ['c'],
        label: 'add an analysis to the focused analysis’s table',
        button: { label: 'Add analysis' },
        unavailable: NOT.addAnalysis,
        run: (s) => openPanelOn(s, 'add_analysis'),
    }),
    { keys: ['Alt+Shift+J'], label: 'next step', run: (s) => view(s).moveStep(1) },
    { keys: ['Alt+Shift+K'], label: 'previous step', run: (s) => view(s).moveStep(-1) },
    {
        keys: ['Shift+H'],
        label: 'show or hide the analyses with no coordinates',
        run: (s) => view(s).toggleNonCoordinate(),
    },
    { keys: ['Shift+V'], label: 'show or hide all the evidence', run: (s) => view(s).toggleAllEvidence() },
    { keys: ['o', 'Shift+O'], label: 'toggle the outline', run: (s) => view(s).toggleOutline() },
    { keys: ['d', 'Shift+D'], label: 'show or hide the diff against the original', run: (s) => view(s).toggleDiff() },
    { keys: ['Escape'], label: 'leave the diff', run: (s) => view(s).toggleDiff(false) },
    { keys: ['Ctrl+Z'], label: 'undo the last edit (Cmd for Ctrl on a Mac)', run: (s) => session(s).undo() },
    {
        keys: ['Ctrl+Shift+Z', 'Ctrl+Y'],
        label: 'redo the last undone edit',
        run: (s) => session(s).redo(),
    },
    {
        keys: ['Ctrl+K'],
        label: 'command palette: search entities, slots, values and the paper text',
        run: (s) => view(s).togglePalette(true),
    },
    { keys: ['?'], label: 'show these shortcuts', run: (s) => view(s).toggleHelp(true) },
];

const TEXT_FIELD =
    'input:not([type="radio"]):not([type="checkbox"]), textarea, select, [contenteditable]:not([contenteditable="false"])';
const DIALOG = '[role="dialog"]';
const CONTROL = 'button, a[href], [role="button"], [role="option"], [role="radio"], [role="menuitem"]';

const within = (target: EventTarget | null, selector: string) =>
    target instanceof Element && target.closest(selector) !== null;

/** A spreadsheet, whose keys are its own but undo and redo. */
const GRID = '[data-coordinate-table]';
const THROUGH_GRID = new Set(['Ctrl+Z', 'Ctrl+Shift+Z', 'Ctrl+Y']);

export const isTextField = (target: EventTarget | null) => within(target, TEXT_FIELD);
export const isControl = (target: EventTarget | null) => within(target, CONTROL);

/** The key as the table names it: a letter or named key pressed with Shift is `Shift+` and its name. */
const plainKeyName = (event: KeyboardEvent) =>
    event.shiftKey && /^[a-z]$/i.test(event.key)
        ? `Shift+${event.key.toUpperCase()}`
        : event.shiftKey && event.key.length > 1
          ? `Shift+${event.key}`
          : event.key;

/** `Alt+Shift+` and the letter of the key pressed; '' for any other key. */
const altKeyName = (event: KeyboardEvent) =>
    event.shiftKey && /^Key[A-Z]$/.test(event.code) ? `Alt+Shift+${event.code.slice(3)}` : '';

/** A letter pressed with Ctrl or Cmd as the table names it, `Ctrl+`, then `Shift+` if pressed, then the letter; '' for any other key. */
const ctrlKeyName = (event: KeyboardEvent) =>
    /^[a-z]$/i.test(event.key) ? `Ctrl+${event.shiftKey ? 'Shift+' : ''}${event.key.toUpperCase()}` : '';

/** The key as the table names it, by the modifiers held; '' for a combination the table has no name for. */
function keyName(event: KeyboardEvent) {
    if (event.ctrlKey || event.metaKey) return event.altKey ? '' : ctrlKeyName(event);
    return event.altKey ? altKeyName(event) : plainKeyName(event);
}

export function useShortcuts(stores: ReviewStores, table: Shortcut[], enabled: (view: ViewState) => boolean) {
    useEffect(() => {
        const byKey = new Map<string, Shortcut[]>();
        for (const shortcut of table) {
            for (const key of shortcut.keys) byKey.set(key, [...(byKey.get(key) ?? []), shortcut]);
        }
        const onKeyDown = (event: KeyboardEvent) => {
            if (isTextField(event.target) || within(event.target, DIALOG)) return;
            if (within(event.target, GRID) && !THROUGH_GRID.has(keyName(event))) return;
            if ((event.key === 'Enter' || event.key === ' ') && isControl(event.target)) return;
            const scope: Scope = view(stores).coordinates ? 'coordinates' : 'record';
            const inScope = (key: string) => byKey.get(key)?.find((s) => (s.scope ?? scope) === scope);
            const plain = !event.ctrlKey && !event.metaKey && !event.altKey;
            const capsLock = plain && /^[A-Z]$/.test(event.key) ? inScope(`Shift+${event.key}`) : undefined;
            const shortcut = inScope(keyName(event)) ?? capsLock;
            if (!shortcut || !enabled(view(stores))) return;
            event.preventDefault();
            shortcut.run(stores);
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [stores, table, enabled]);
}
