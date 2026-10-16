import { useState, type KeyboardEvent, type MouseEvent } from 'react';
import type { RecordIndex, SlotNode } from '../model/record';
import { useReviewStoreApi } from '../store/context';
import type { HighlightLayer } from './highlights';
import type { SupportChoice } from './SupportMenu';
import type { TextIndex } from './TextIndex';

/** The character offset under a viewport point, or null where the point is outside the paper text. */
export function offsetAtPoint(index: TextIndex, x: number, y: number): number | null {
    const position = document.caretPositionFromPoint?.(x, y);
    if (position) return index.fromPoint(position.offsetNode, position.offset);
    const range = document.caretRangeFromPoint?.(x, y);
    return range ? index.fromPoint(range.startContainer, range.startOffset) : null;
}

/** The visible slots whose evidence covers the character at `offset`, in record order. */
export function slotsAt(index: RecordIndex, offset: number): SlotNode[] {
    return index.visible
        .flatMap((entity) => entity.slots)
        .filter((slot) => slot.spans.some(([start, end]) => start <= offset && offset < end));
}

/** Focuses the item a click or Enter on the paper text points at, or lists the items in a menu where there are several. */
export function useSupportingFocus(index: TextIndex | null, layer: HighlightLayer | null) {
    const store = useReviewStoreApi();
    const [choice, setChoice] = useState<SupportChoice | null>(null);

    const focusSupporting = (slots: SlotNode[], at: SupportChoice['at']) => {
        if (slots.length === 1) return store.getState().focusSlot(slots[0].key);
        if (slots.length > 1) {
            const { index: records } = store.getState();
            const items = slots.map((slot) => ({
                key: slot.key,
                label: `${records.entity(slot.entity)?.name ?? slot.entity} · ${slot.path}`,
            }));
            setChoice({ items, at });
        }
    };

    const onClick = (event: MouseEvent<HTMLDivElement>) => {
        if (!index) return;
        const offset = offsetAtPoint(index, event.clientX, event.clientY);
        if (offset === null) return;
        focusSupporting(slotsAt(store.getState().index, offset), { top: event.clientY, left: event.clientX });
    };

    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key !== 'Enter') return;
        event.stopPropagation();
        const { focusedSpans, evidenceCursor, index: records } = store.getState();
        const span = focusedSpans[evidenceCursor];
        if (!span || !layer) return;
        const rect = layer.range(span).getBoundingClientRect();
        focusSupporting(slotsAt(records, span[0]), { top: rect.bottom, left: rect.left });
    };

    return {
        onClick,
        onKeyDown,
        menu: {
            choice,
            onChoose: (key: string) => {
                setChoice(null);
                store.getState().focusSlot(key);
            },
            onClose: () => setChoice(null),
        },
    };
}
