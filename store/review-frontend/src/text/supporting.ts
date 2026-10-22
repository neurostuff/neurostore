import { useEffect, useState, type KeyboardEvent, type MouseEvent } from 'react';
import type { RecordIndex, SlotNode } from '../model/record';
import { fieldLabel, slotLabel } from '../model/labels';
import { useReviewStores } from '../store/context';
import { selectEvidenceCursor, selectFocusedSpans, selectShown } from '../store/viewSelectors';
import type { HighlightLayer } from './highlights';
import type { SupportChoice, SupportGroup } from './SupportMenu';
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

/** The slots grouped by their entity, in record order; the focused slot, and its entity's group, come first. */
function byEntity(records: RecordIndex, slots: SlotNode[], focused: string): SupportGroup[] {
    const ordered = [...slots.filter((slot) => slot.key === focused), ...slots.filter((slot) => slot.key !== focused)];
    const groups = new Map<string, SupportGroup>();
    for (const slot of ordered) {
        let group = groups.get(slot.entity);
        if (!group) {
            group = { entity: slot.entity, name: records.entity(slot.entity)?.name ?? slot.entity, items: [] };
            groups.set(slot.entity, group);
        }
        group.items.push({ key: slot.key, field: slotLabel(records, slot), label: fieldLabel(records, slot) });
    }
    return [...groups.values()];
}

// The DOM's selection, not the view's: that follows selectionchange, which can come after the click ending a drag.
const selecting = () => !(window.getSelection()?.isCollapsed ?? true);

/** Focuses the item a click or Enter on the paper text points at, or lists the items in a menu where there are several. */
export function useSupportingFocus(index: TextIndex | null, layer: HighlightLayer | null) {
    const { session, view } = useReviewStores();
    const [choice, setChoice] = useState<SupportChoice | null>(null);

    useEffect(
        () =>
            view.subscribe(({ selection }) => {
                if (selection) setChoice(null);
            }),
        [view]
    );

    const focusSupporting = (slots: SlotNode[], at: SupportChoice['at']) => {
        if (slots.length === 1) return view.getState().focusSlot(slots[0].key);
        if (slots.length > 1) {
            const groups = byEntity(session.getState().index, slots, view.getState().focus.key);
            setChoice({ groups, at });
        }
    };

    const onClick = (event: MouseEvent<HTMLDivElement>) => {
        if (!index || selecting()) return;
        const offset = offsetAtPoint(index, event.clientX, event.clientY);
        if (offset === null) return;
        const listed = selectShown(session.getState(), view.getState());
        focusSupporting(slotsAt(listed, offset), { top: event.clientY, left: event.clientX });
    };

    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key !== 'Enter') return;
        event.stopPropagation();
        const documents = session.getState();
        const focused = view.getState();
        const span = selectFocusedSpans(documents, focused)[selectEvidenceCursor(documents, focused)];
        if (!span || !layer) return;
        const rect = layer.range(span).getBoundingClientRect();
        focusSupporting(slotsAt(selectShown(documents, focused), span[0]), { top: rect.bottom, left: rect.left });
    };

    return {
        onClick,
        onKeyDown,
        menu: {
            choice,
            onChoose: (key: string) => {
                setChoice(null);
                view.getState().focusSlot(key);
            },
            onClose: () => setChoice(null),
        },
    };
}
