import { useEffect, useState } from 'react';
import type { SpanPair } from '../model/record';
import type { TextIndex } from './TextIndex';

export interface SelectionOffsets {
    offsets: SpanPair | null;
    rect: DOMRect | null;
}

const NONE: SelectionOffsets = { offsets: null, rect: null };

export function useSelectionOffsets(index: TextIndex | null): SelectionOffsets {
    const [selection, setSelection] = useState(NONE);

    useEffect(() => {
        if (!index) return;
        const onSelectionChange = () => {
            const current = window.getSelection();
            const range = current && current.rangeCount > 0 ? current.getRangeAt(0) : null;
            const offsets = range && !range.collapsed ? index.fromRange(range) : null;
            setSelection(range && offsets ? { offsets, rect: range.getBoundingClientRect() } : NONE);
        };
        document.addEventListener('selectionchange', onSelectionChange);
        return () => document.removeEventListener('selectionchange', onSelectionChange);
    }, [index]);

    return selection;
}
