/**
 * A LockManager for one origin, granting an exclusive lock as Web Locks does: at once when it is free; when it is
 * held, refused at once with `ifAvailable`, else granted once the holder lets go.
 */
export function fakeLocks() {
    const held = new Set<string>();
    const asked: string[] = [];
    const waiting = new Map<string, (() => void)[]>();

    async function hold(name: string, callback: (lock: Lock | null) => Promise<void>) {
        try {
            return await callback({ name, mode: 'exclusive' });
        } finally {
            const next = waiting.get(name)?.shift();
            if (next) next();
            else held.delete(name);
        }
    }

    const request = async (name: string, options: LockOptions, callback: (lock: Lock | null) => Promise<void>) => {
        asked.push(name);
        if (!held.has(name)) {
            held.add(name);
            return hold(name, callback);
        }
        if (options.ifAvailable) return callback(null);
        await new Promise<void>((granted) => waiting.set(name, [...(waiting.get(name) ?? []), granted]));
        return hold(name, callback);
    };

    const locks = { request, query: async () => ({}) } as unknown as LockManager;
    return { locks, held, asked };
}
