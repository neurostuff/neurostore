import { useLayoutEffect, useState, type RefObject } from 'react';

/** A count that goes up each time the scroller or the text in it is resized, for measurements that follow their layout. */
export function useResized(scrollerRef: RefObject<HTMLElement | null>, textRef: RefObject<HTMLElement | null>): number {
    const [resizes, setResizes] = useState(0);
    useLayoutEffect(() => {
        const elements = [scrollerRef.current, textRef.current].filter((e) => e !== null);
        if (elements.length === 0 || typeof ResizeObserver === 'undefined') return;
        const observer = new ResizeObserver(() => setResizes((n) => n + 1));
        for (const element of elements) observer.observe(element);
        return () => observer.disconnect();
    }, [scrollerRef, textRef]);
    return resizes;
}
