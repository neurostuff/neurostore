import type { KeyboardEvent } from 'react';
import { isControl } from '../review/shortcuts';

/** A key handler for a panel: `onKey` may claim a key first; Enter submits and Esc cancels, from anywhere in it but a control. */
export function panelKeys(submit: () => void, cancel: () => void, onKey?: (event: KeyboardEvent) => boolean) {
    return (event: KeyboardEvent) => {
        if (onKey?.(event)) return;
        if (event.key === 'Escape') {
            event.preventDefault();
            cancel();
        } else if (event.key === 'Enter' && !isControl(event.target)) {
            event.preventDefault();
            submit();
        }
    };
}
