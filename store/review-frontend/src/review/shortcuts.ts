import { useEffect } from 'react';
import { accept, acceptCard, createOn } from '../inspector/actions';
import type { ReviewState, ReviewStore } from '../store/reviewStore';
import { addSelection } from '../text/addSelection';

export interface Shortcut {
    keys: string[];
    label: string;
    run(state: ReviewState): void;
}

export const SHORTCUTS: Shortcut[] = [
    { keys: ['j'], label: 'next slot', run: (s) => s.moveSlot(1) },
    { keys: ['k'], label: 'previous slot', run: (s) => s.moveSlot(-1) },
    { keys: ['Shift+J'], label: 'next entity', run: (s) => s.moveEntity(1) },
    { keys: ['Shift+K'], label: 'previous entity', run: (s) => s.moveEntity(-1) },
    { keys: [']'], label: 'next evidence span', run: (s) => s.stepEvidence(1) },
    { keys: ['['], label: 'previous evidence span', run: (s) => s.stepEvidence(-1) },
    { keys: ['e'], label: 'add the selection to the slot’s evidence', run: (s) => addSelection(s, 'first') },
    { keys: ['Shift+E'], label: 'add the selection as a new evidence set', run: (s) => addSelection(s, 'new') },
    { keys: ['a'], label: 'accept the focused slot, entity or link', run: (s) => void accept(s) },
    {
        keys: ['Shift+A'],
        label: 'accept every untouched slot on the card that has evidence',
        run: (s) => void acceptCard(s),
    },
    { keys: ['r'], label: 'reject, with a reason (1–5) and an optional note', run: (s) => s.openPanel('reject') },
    { keys: ['Enter'], label: 'edit the focused value; Enter saves, Esc cancels', run: (s) => s.openPanel('edit') },
    {
        keys: ['n'],
        label: 'mark the focused slot not reported, with its reason',
        run: (s) => s.openPanel('not_reported'),
    },
    { keys: ['l'], label: 'link the focused reference slot to an entity', run: (s) => s.openPanel('link') },
    {
        keys: ['c'],
        label: 'create an entity in the focused entity’s list; asks which class where the list has several',
        run: (s) => createOn(s),
    },
    {
        keys: ['Shift+Backspace'],
        label: 'delete the focused entity, after confirming',
        run: (s) => s.openPanel('delete'),
    },
    { keys: [';'], label: 'add a note to the focused item', run: (s) => s.openPanel('note') },
    { keys: ['o', 'Shift+O'], label: 'toggle the outline', run: (s) => s.toggleOutline() },
    { keys: ['?'], label: 'show these shortcuts', run: (s) => s.toggleHelp(true) },
];

const TEXT_FIELD =
    'input:not([type="radio"]):not([type="checkbox"]), textarea, select, [contenteditable]:not([contenteditable="false"])';
const CONTROL = 'button, a[href], [role="button"], [role="option"], [role="radio"]';

const within = (target: EventTarget | null, selector: string) =>
    target instanceof Element && target.closest(selector) !== null;

export const isTextField = (target: EventTarget | null) => within(target, TEXT_FIELD);
export const isControl = (target: EventTarget | null) => within(target, CONTROL);

/** The key as the table names it: a letter or named key pressed with Shift is `Shift+` and its name. */
const keyName = (event: KeyboardEvent) =>
    event.shiftKey && /^[a-z]$/i.test(event.key)
        ? `Shift+${event.key.toUpperCase()}`
        : event.shiftKey && event.key.length > 1
          ? `Shift+${event.key}`
          : event.key;

export function useShortcuts(store: ReviewStore, table: Shortcut[], enabled: (state: ReviewState) => boolean) {
    useEffect(() => {
        const byKey = new Map(table.flatMap((shortcut) => shortcut.keys.map((key) => [key, shortcut] as const)));
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.ctrlKey || event.metaKey || event.altKey || isTextField(event.target)) return;
            if (event.key === 'Enter' && isControl(event.target)) return;
            const capsLock = /^[A-Z]$/.test(event.key) ? byKey.get(`Shift+${event.key}`) : undefined;
            const shortcut = byKey.get(keyName(event)) ?? capsLock;
            const state = store.getState();
            if (!shortcut || !enabled(state)) return;
            event.preventDefault();
            shortcut.run(state);
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [store, table, enabled]);
}
