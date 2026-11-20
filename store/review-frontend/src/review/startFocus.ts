import { useCallback, useState } from 'react';

/** A ref that focuses its element once it is attached, when `on` was at the first render, as autoFocus does. */
export function useStartFocus<T extends HTMLElement>(on = true) {
    const [focusing] = useState(on);
    return useCallback(
        (element: T | null) => {
            if (focusing) element?.focus();
        },
        [focusing]
    );
}
