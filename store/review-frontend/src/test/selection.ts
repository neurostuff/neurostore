import { act } from '@testing-library/react';
import { TextIndex } from '../text/TextIndex';

/** Selects the paper text under `root` from `start` to `end`, as a drag does, and lets the app know. */
export function selectText(root: HTMLElement, [start, end]: [number, number]) {
    act(() => {
        const selection = window.getSelection()!;
        selection.removeAllRanges();
        selection.addRange(TextIndex.build(root).toRange(start, end));
        document.dispatchEvent(new Event('selectionchange'));
    });
}

/** Clears the selection, and lets the app know. */
export function clearSelection() {
    act(() => {
        window.getSelection()!.removeAllRanges();
        document.dispatchEvent(new Event('selectionchange'));
    });
}
