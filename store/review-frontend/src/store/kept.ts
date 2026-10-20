/** What this device keeps under `key`, as `read` makes of it; undefined where nothing is kept, or the browser keeps nothing. */
export function readKept<T>(key: string, read: (kept: unknown) => T | undefined): T | undefined {
    try {
        const kept = localStorage.getItem(key);
        return kept === null ? undefined : read(JSON.parse(kept));
    } catch {
        return undefined;
    }
}

export function writeKept(key: string, value: unknown) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {
        // A browser that keeps nothing forgets it.
    }
}
