import { useEffect } from 'react';
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
    { keys: ['J'], label: 'next entity', run: (s) => s.moveEntity(1) },
    { keys: ['K'], label: 'previous entity', run: (s) => s.moveEntity(-1) },
    { keys: [']'], label: 'next evidence span', run: (s) => s.stepEvidence(1) },
    { keys: ['['], label: 'previous evidence span', run: (s) => s.stepEvidence(-1) },
    { keys: ['e'], label: 'add the selection to the slot’s evidence', run: (s) => addSelection(s, 'first') },
    { keys: ['E'], label: 'add the selection as a new evidence set', run: (s) => addSelection(s, 'new') },
    { keys: ['o', 'O'], label: 'toggle the outline', run: (s) => s.toggleOutline() },
    { keys: ['?'], label: 'show these shortcuts', run: (s) => s.toggleHelp(true) },
];

const TEXT_FIELD = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])';

function isTextField(target: EventTarget | null) {
    return target instanceof Element && target.closest(TEXT_FIELD) !== null;
}

export function useShortcuts(store: ReviewStore, table: Shortcut[], enabled: (state: ReviewState) => boolean) {
    useEffect(() => {
        const byKey = new Map(table.flatMap((shortcut) => shortcut.keys.map((key) => [key, shortcut] as const)));
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.ctrlKey || event.metaKey || event.altKey || isTextField(event.target)) return;
            const shortcut = byKey.get(event.key);
            const state = store.getState();
            if (!shortcut || !enabled(state)) return;
            event.preventDefault();
            shortcut.run(state);
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [store, table, enabled]);
}
