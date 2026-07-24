import { useVirtualizer } from '@tanstack/react-virtual';
import React, { useEffect, useState } from 'react';

export type VirtualizedListProps<T> = {
    rows: T[];
    rowHeightInPx?: number;
    listHeightInPx: number;
    getItemKey: (row: T, index: number) => string | number;
    renderRow: (row: T, style: React.CSSProperties, index: number) => React.ReactNode;
    overscan?: number;
    width?: number | string;
    enabled?: boolean;
    /** Merged onto the scroll container (e.g. hello-pangea Droppable innerRef). */
    scrollContainerRef?: React.Ref<HTMLDivElement | null>;
    style?: React.CSSProperties;
    /** When set, scrolls to this index once the list is enabled / the index changes. */
    scrollToIndex?: number;
    scrollToAlign?: 'start' | 'center' | 'end' | 'auto';
    scrollBehavior?: ScrollBehavior;
};

const assignRef = <T,>(ref: React.Ref<T> | undefined, value: T) => {
    if (typeof ref === 'function') {
        ref(value);
    } else if (ref) {
        ref.current = value;
    }
};

function VirtualizedList<T>({
    rows,
    rowHeightInPx = 95,
    listHeightInPx,
    getItemKey,
    renderRow,
    overscan = 3,
    width = '100%',
    enabled = true,
    scrollContainerRef,
    style,
    scrollToIndex,
    scrollToAlign = 'auto',
    scrollBehavior,
}: VirtualizedListProps<T>) {
    const [listScrollElement, setListScrollElement] = useState<HTMLDivElement | null>(null);
    const isEnabled = enabled && listScrollElement != null;

    const rowVirtualizer = useVirtualizer({
        count: rows.length,
        getScrollElement: () => listScrollElement,
        estimateSize: () => rowHeightInPx,
        overscan,
        getItemKey: (index) => {
            const row = rows[index];
            return row === undefined ? index : getItemKey(row, index);
        },
        enabled: isEnabled,
    });

    useEffect(() => {
        if (!isEnabled || scrollToIndex == null || scrollToIndex < 0) return;
        rowVirtualizer.scrollToIndex(scrollToIndex, { align: scrollToAlign, behavior: scrollBehavior });
    }, [isEnabled, scrollToIndex, scrollToAlign, scrollBehavior, rowVirtualizer]);

    const handleScrollElementRef = (element: HTMLDivElement | null) => {
        setListScrollElement(element);
        assignRef(scrollContainerRef, element);
    };

    return (
        <div
            ref={handleScrollElementRef}
            style={{
                height: listHeightInPx,
                width,
                flexShrink: 0,
                overflow: 'auto',
                position: 'relative',
                ...style,
            }}
        >
            <div
                style={{
                    height: `${rowVirtualizer.getTotalSize()}px`,
                    width: '100%',
                    position: 'relative',
                }}
            >
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const row = rows[virtualRow.index];
                    return (
                        <React.Fragment key={virtualRow.key}>
                            {renderRow(
                                row,
                                {
                                    // Use `top` (not transform) so libraries like hello-pangea can apply their own transform during drag.
                                    position: 'absolute',
                                    top: virtualRow.start,
                                    left: 0,
                                    width: '100%',
                                    height: `${virtualRow.size}px`,
                                },
                                virtualRow.index
                            )}
                        </React.Fragment>
                    );
                })}
            </div>
        </div>
    );
}

export default VirtualizedList;
