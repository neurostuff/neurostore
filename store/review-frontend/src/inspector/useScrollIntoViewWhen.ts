import { useEffect, useRef } from 'react';

/** A ref whose element scrolls into view, as little as it takes, each time `focused` turns true. */
export function useScrollIntoViewWhen<T extends HTMLElement>(focused: boolean) {
    const ref = useRef<T>(null);
    useEffect(() => {
        if (focused) ref.current?.scrollIntoView?.({ block: 'nearest' });
    }, [focused]);
    return ref;
}
