import { useEffect, useRef } from 'react';

export type KeyboardShortcutHandler = (event: KeyboardEvent) => void;

const INTERACTIVE_TARGET_SELECTOR =
    'input, textarea, select, [contenteditable="true"], [role="listbox"], [role="menu"], [role="combobox"], [role="dialog"]';

const useKeyboardShortcuts = (shortcuts: Record<string, KeyboardShortcutHandler>, enabled = true) => {
    const shortcutsRef = useRef(shortcuts);
    shortcutsRef.current = shortcuts;

    useEffect(() => {
        if (!enabled) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            const handler = shortcutsRef.current[event.key];
            if (!handler) return;
            if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;

            // Skip when the key is being used in an input or popup (menu, autocomplete, dialog)
            // so those controls can move a cursor or highlight an option.
            const target = event.target;
            if (target instanceof HTMLElement && target.closest(INTERACTIVE_TARGET_SELECTOR)) {
                return;
            }

            event.preventDefault();
            handler(event);
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [enabled]);
};

export default useKeyboardShortcuts;
