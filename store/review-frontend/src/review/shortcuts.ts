import { useEffect } from 'react';
import { acceptAnalysis, removePoint, splitAnalysis } from '../coordinates/actions';
import { accept, acceptCard, createOn } from '../inspector/actions';
import type { ReviewState, ReviewStore } from '../store/reviewStore';
import { addSelection } from '../text/addSelection';

/** Where a shortcut acts: on a record item, on a coordinate analysis, or (unscoped) anywhere. */
export type Scope = 'record' | 'coordinates';

export interface Shortcut {
    keys: string[];
    label: string;
    scope?: Scope;
    /** The toolbar button that runs the shortcut, if it has one. */
    button?: { label: string; color?: 'error' };
    run(state: ReviewState): void;
}

/** The key as the table names it: a letter is upper case, a named key is as written, Space is spelt out. */
export const keyLabel = (key: string) => {
    if (key === ' ') return 'Space';
    if (key.length > 1) return key;
    return key !== key.toLowerCase() ? `Shift+${key}` : key.toUpperCase();
};

const record = (shortcut: Omit<Shortcut, 'scope'>): Shortcut => ({ ...shortcut, scope: 'record' });
const coordinates = (shortcut: Omit<Shortcut, 'scope'>): Shortcut => ({ ...shortcut, scope: 'coordinates' });

export const SHORTCUTS: Shortcut[] = [
    record({ keys: ['j'], label: 'next slot', run: (s) => s.moveSlot(1) }),
    record({ keys: ['k'], label: 'previous slot', run: (s) => s.moveSlot(-1) }),
    record({ keys: ['Shift+J'], label: 'next entity', run: (s) => s.moveEntity(1) }),
    record({ keys: ['Shift+K'], label: 'previous entity', run: (s) => s.moveEntity(-1) }),
    { keys: [']'], label: 'next evidence span', run: (s) => s.stepEvidence(1) },
    { keys: ['['], label: 'previous evidence span', run: (s) => s.stepEvidence(-1) },
    record({ keys: ['e'], label: 'add the selection to the slot’s evidence', run: (s) => addSelection(s, 'first') }),
    record({ keys: ['Shift+E'], label: 'add the selection as a new evidence set', run: (s) => addSelection(s, 'new') }),
    record({
        keys: ['a'],
        label: 'accept the focused slot, entity or link',
        button: { label: 'Accept' },
        run: (s) => void accept(s),
    }),
    record({
        keys: ['Shift+A'],
        label: 'accept every untouched slot on the card that has evidence',
        run: (s) => void acceptCard(s),
    }),
    record({
        keys: ['r'],
        label: 'reject, with a reason (1–5) and an optional note',
        button: { label: 'Reject', color: 'error' },
        run: (s) => s.openPanel('reject'),
    }),
    record({
        keys: ['Enter'],
        label: 'edit the focused value; Enter saves, Esc cancels',
        run: (s) => s.openPanel('edit'),
    }),
    record({
        keys: ['n'],
        label: 'mark the focused slot not reported, with its reason',
        run: (s) => s.openPanel('not_reported'),
    }),
    record({ keys: ['l'], label: 'link the focused reference slot to an entity', run: (s) => s.openPanel('link') }),
    record({
        keys: ['c'],
        label: 'create an entity in the focused entity’s list; asks which class where the list has several',
        run: (s) => createOn(s),
    }),
    record({
        keys: ['Shift+Backspace'],
        label: 'delete the focused entity, after confirming',
        run: (s) => s.openPanel('delete'),
    }),
    record({
        keys: [';'],
        label: 'add a note to the focused item',
        button: { label: 'Note' },
        run: (s) => s.openPanel('note'),
    }),
    coordinates({ keys: ['j'], label: 'next point', run: (s) => s.movePoint(1) }),
    coordinates({
        keys: ['k'],
        label: 'previous point; from the first, back to the analysis',
        run: (s) => s.movePoint(-1),
    }),
    coordinates({ keys: ['Shift+J'], label: 'next analysis', run: (s) => s.moveAnalysis(1) }),
    coordinates({ keys: ['Shift+K'], label: 'previous analysis', run: (s) => s.moveAnalysis(-1) }),
    coordinates({
        keys: ['a'],
        label: 'accept the focused analysis',
        button: { label: 'Accept' },
        run: (s) => void acceptAnalysis(s),
    }),
    coordinates({
        keys: ['Shift+Backspace'],
        label: 'reject the focused analysis: with a reason (1–5) and an optional note',
        button: { label: 'Reject', color: 'error' },
        run: (s) => s.openPanel('reject'),
    }),
    coordinates({
        keys: [';'],
        label: 'add a note to the focused analysis',
        button: { label: 'Note' },
        run: (s) => s.openPanel('note'),
    }),
    coordinates({
        keys: ['r'],
        label: 'relabel the focused analysis with another role',
        button: { label: 'Relabel' },
        run: (s) => s.openPanel('relabel'),
    }),
    coordinates({
        keys: ['Enter'],
        label: 'edit the focused point; Enter saves, Esc cancels',
        button: { label: 'Edit point' },
        run: (s) => s.openPanel('edit_point'),
    }),
    coordinates({
        keys: [' '],
        label: 'select or unselect the focused point; on the analysis, select it for a merge',
        run: (s) => s.togglePoint(),
    }),
    coordinates({
        keys: ['p'],
        label: 'add a point to the focused analysis',
        button: { label: 'Add point' },
        run: (s) => s.openPanel('add_point'),
    }),
    coordinates({
        keys: ['Backspace'],
        label: 'remove the focused point',
        button: { label: 'Remove point' },
        run: (s) => void removePoint(s),
    }),
    coordinates({
        keys: ['m'],
        label: 'move the selected points, or the focused one, to another analysis',
        button: { label: 'Move' },
        run: (s) => s.openPanel('move'),
    }),
    coordinates({
        keys: ['s'],
        label: 'split the focused analysis: the selected points, then the rest',
        button: { label: 'Split' },
        run: (s) => void splitAnalysis(s),
    }),
    coordinates({
        keys: ['g'],
        label: 'merge the analyses selected for a merge with the focused one, after confirming',
        button: { label: 'Merge' },
        run: (s) => s.openPanel('merge'),
    }),
    coordinates({
        keys: ['c'],
        label: 'add an analysis to the focused analysis’s table',
        button: { label: 'Add analysis' },
        run: (s) => s.openPanel('add_analysis'),
    }),
    {
        keys: ['Shift+H'],
        label: 'show or hide the analyses with no coordinates',
        run: (s) => s.toggleNonCoordinate(),
    },
    { keys: ['Shift+V'], label: 'show or hide all the evidence', run: (s) => s.toggleAllEvidence() },
    { keys: ['o', 'Shift+O'], label: 'toggle the outline', run: (s) => s.toggleOutline() },
    { keys: ['Ctrl+Z'], label: 'undo the last edit (Cmd for Ctrl on a Mac)', run: (s) => s.undo() },
    {
        keys: ['Ctrl+Shift+Z', 'Ctrl+Y'],
        label: 'redo the last undone edit',
        run: (s) => s.redo(),
    },
    {
        keys: ['Ctrl+K'],
        label: 'command palette: search entities, slots, values and the paper text',
        run: (s) => s.togglePalette(true),
    },
    { keys: ['?'], label: 'show these shortcuts', run: (s) => s.toggleHelp(true) },
];

const TEXT_FIELD =
    'input:not([type="radio"]):not([type="checkbox"]), textarea, select, [contenteditable]:not([contenteditable="false"])';
const CONTROL = 'button, a[href], [role="button"], [role="option"], [role="radio"], [role="menuitem"]';

const within = (target: EventTarget | null, selector: string) =>
    target instanceof Element && target.closest(selector) !== null;

export const isTextField = (target: EventTarget | null) => within(target, TEXT_FIELD);
export const isControl = (target: EventTarget | null) => within(target, CONTROL);

/** The key as the table names it: a letter or named key pressed with Shift is `Shift+` and its name. */
const plainKeyName = (event: KeyboardEvent) =>
    event.shiftKey && /^[a-z]$/i.test(event.key)
        ? `Shift+${event.key.toUpperCase()}`
        : event.shiftKey && event.key.length > 1
          ? `Shift+${event.key}`
          : event.key;

/** A letter pressed with Ctrl or Cmd as the table names it, `Ctrl+`, then `Shift+` if pressed, then the letter; '' for any other key. */
const ctrlKeyName = (event: KeyboardEvent) =>
    /^[a-z]$/i.test(event.key) ? `Ctrl+${event.shiftKey ? 'Shift+' : ''}${event.key.toUpperCase()}` : '';

export function useShortcuts(store: ReviewStore, table: Shortcut[], enabled: (state: ReviewState) => boolean) {
    useEffect(() => {
        const byKey = new Map<string, Shortcut[]>();
        for (const shortcut of table) {
            for (const key of shortcut.keys) byKey.set(key, [...(byKey.get(key) ?? []), shortcut]);
        }
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.altKey || isTextField(event.target)) return;
            if ((event.key === 'Enter' || event.key === ' ') && isControl(event.target)) return;
            const withCtrl = event.ctrlKey || event.metaKey;
            const state = store.getState();
            const scope: Scope = state.coordinates ? 'coordinates' : 'record';
            const inScope = (key: string) => byKey.get(key)?.find((s) => (s.scope ?? scope) === scope);
            const capsLock = !withCtrl && /^[A-Z]$/.test(event.key) ? inScope(`Shift+${event.key}`) : undefined;
            const shortcut = inScope(withCtrl ? ctrlKeyName(event) : plainKeyName(event)) ?? capsLock;
            if (!shortcut || !enabled(state)) return;
            event.preventDefault();
            shortcut.run(state);
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [store, table, enabled]);
}
