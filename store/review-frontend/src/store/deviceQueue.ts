/**
 * The pending ops of each review as this device keeps them, in IndexedDB. Nothing here rejects: the first access
 * that fails calls the queue's `onFail`, its one failure channel, and from then on the queue reads and writes nothing.
 */
import type { KeptOps, SessionStore } from './sessionStore';

export const QUEUE_VERSION = 2;
/** The versions this one reads: 1 kept no collected point edits. */
export const READ_VERSIONS = [1, QUEUE_VERSION];
const WRITE_EVERY_MS = 250;

const DATABASE = 'neurostore-review';
const PENDING = 'pending';

/** The pending ops of one review as this device keeps them. */
export interface StoredQueue extends KeptOps {
    version: number;
    review_id: string;
    saved_at: string;
}

export interface DeviceQueue {
    read(reviewId: string): Promise<StoredQueue | undefined>;
    write(entry: StoredQueue): Promise<void>;
    remove(reviewId: string): Promise<void>;
}

const answered = <T>(request: IDBRequest<T>) =>
    new Promise<T>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });

export async function openDeviceQueue(factory: IDBFactory, onFail: () => void): Promise<DeviceQueue> {
    let db: IDBDatabase | null = null;
    const fail = () => {
        if (db === null) return;
        db = null;
        onFail();
    };
    try {
        const opening = factory.open(DATABASE, 1);
        opening.onupgradeneeded = () => opening.result.createObjectStore(PENDING, { keyPath: 'review_id' });
        db = await answered(opening);
    } catch {
        onFail();
    }
    const run = async <T>(mode: IDBTransactionMode, act: (store: IDBObjectStore) => IDBRequest<T>) => {
        if (db === null) return undefined;
        const open = db;
        try {
            return await new Promise<T>((resolve, reject) => {
                const transaction = open.transaction(PENDING, mode);
                const request = act(transaction.objectStore(PENDING));
                transaction.oncomplete = () => resolve(request.result);
                transaction.onerror = transaction.onabort = () => reject(transaction.error);
            });
        } catch {
            fail();
            return undefined;
        }
    };
    return {
        read: (reviewId) => run('readonly', (store) => store.get(reviewId)),
        write: async (entry) => void (await run('readwrite', (store) => store.put(entry))),
        remove: async (reviewId) => void (await run('readwrite', (store) => store.delete(reviewId))),
    };
}

/**
 * Writes the store's pending ops and collected point edits to `queue` at most every WRITE_EVERY_MS, and at once
 * when the page is hidden.
 */
export function keepPending(store: SessionStore, queue: DeviceQueue, reviewId: string) {
    let timer: ReturnType<typeof setTimeout> | undefined;

    function write(): Promise<void> {
        clearTimeout(timer);
        timer = undefined;
        const { pending, groupOf, intents, collected } = store.getState();
        if (pending.length === 0 && collected.length === 0) return queue.remove(reviewId);
        return queue.write({
            version: QUEUE_VERSION,
            review_id: reviewId,
            ops: pending,
            groupOf,
            intents,
            ...(collected.length > 0 && { collected }),
            saved_at: new Date().toISOString(),
        });
    }

    const writeNow = () => void write();
    /** Writes once the event's other listeners have run, so the op client's send on hiding is what is written. */
    const writeAfter = () => queueMicrotask(writeNow);
    const onVisibility = () => {
        if (document.visibilityState === 'hidden') writeAfter();
    };
    const unsubscribe = store.subscribe((next, previous) => {
        if ((next.pending === previous.pending && next.collected === previous.collected) || timer !== undefined) return;
        timer = setTimeout(writeNow, WRITE_EVERY_MS);
    });
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', writeAfter);

    function stop() {
        clearTimeout(timer);
        timer = undefined;
        unsubscribe();
        document.removeEventListener('visibilitychange', onVisibility);
        window.removeEventListener('pagehide', writeAfter);
    }

    return { write, stop };
}
