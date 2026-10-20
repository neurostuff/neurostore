import type { ReviewApi } from '../api/reviewApi';
import type { ReviewBundle } from '../contract/generated/review-bundle';
import { keepPending, openDeviceQueue, READ_VERSIONS } from './deviceQueue';
import { createOpClient } from './opClient';
import { createReviewStores } from './reviewStores';
import type { DeviceStatus } from './sessionStore';

export const UNKNOWN_VERSION = 'edits kept on this device by another version of the app were dropped';

export const NOT_KEPT = 'edits are not kept on this device: closing the tab before they are saved loses them';

export const OTHER_TAB = 'open in another tab: this one is read-only';

/** The browser's IndexedDB and Web Locks, each undefined where the browser has none, as in a server render. */
export interface Device {
    indexedDB: IDBFactory | undefined;
    locks: LockManager | undefined;
}

/**
 * Asks for the lock `name` if no tab holds it, keeping it until the returned release is called; null when another
 * tab holds it. Where asking throws, the tab goes on without the lock, editable as if it held it.
 */
function takeLock(locks: LockManager, name: string): Promise<(() => void) | null> {
    return new Promise((resolve) => {
        let release = () => {};
        const held = new Promise<void>((done) => (release = done));
        locks
            .request(name, { ifAvailable: true }, (lock) => {
                if (!lock) return resolve(null);
                resolve(release);
                return held;
            })
            .catch(() => resolve(() => {}));
    });
}

/** Where a tab is with its review: not yet opened, taking the lock and the kept ops, taking edits, or let go of it. */
type Phase = 'idle' | 'loading' | 'editable' | 'released';

/** The stores of `bundle` and their op client, with the pending ops kept on this device. */
export function createReviewSession(bundle: ReviewBundle, api: ReviewApi, device: Device) {
    const stores = createReviewStores(bundle);
    const { session } = stores;
    const client = createOpClient(session, api);
    const reviewId = bundle.review?.id;
    let phase: Phase = 'idle';
    let loading = Promise.resolve();
    let teardown: ReturnType<typeof setTimeout> | undefined;
    let keeper: ReturnType<typeof keepPending> | null = null;
    let release = () => {};
    let closed = () => {};
    let lost = false;

    const setDevice = (status: DeviceStatus, notice?: string) => session.getState().setDevice(status, notice);

    function notKept() {
        lost = true;
        keeper?.stop();
        keeper = null;
        setDevice('memory', NOT_KEPT);
    }

    /** Puts the ops this device kept for the review in pending, then keeps them as they change. */
    async function restore(factory: IDBFactory, id: string) {
        const queue = await openDeviceQueue(factory, notKept);
        const entry = await queue.read(id);
        if (lost) return;
        if (entry && !READ_VERSIONS.includes(entry.version)) {
            await queue.remove(id);
            if (lost) return;
            setDevice('kept', UNKNOWN_VERSION);
        } else {
            if (entry) session.getState().restore(entry);
            setDevice('kept');
        }
        keeper = keepPending(session, queue, id);
    }

    /** Writes what is kept, then lets go of the lock, so the next tab to take it reads the write. */
    function letGo(): Promise<void> {
        phase = 'released';
        const written = keeper?.write() ?? Promise.resolve();
        keeper?.stop();
        keeper = null;
        const free = release;
        release = () => {};
        return written.catch(() => {}).then(free);
    }

    function begin() {
        if (phase === 'released') return void letGo();
        phase = 'editable';
        if (teardown !== undefined) return;
        client.start();
        const { pending, collected } = session.getState();
        if (pending.length > 0 || collected.length > 0) void client.flush();
    }

    async function load() {
        if (!reviewId) return begin();
        if (device.locks || device.indexedDB) setDevice('loading');
        if (device.locks) {
            const held = await takeLock(device.locks, `neurostore-review:${reviewId}`);
            if (!held) return setDevice('readonly', OTHER_TAB);
            release = held;
            if (phase === 'released') return void letGo();
        }
        if (device.indexedDB) await restore(device.indexedDB, reviewId);
        else notKept();
        begin();
    }

    return {
        stores,
        client,
        /** Takes the review's lock, restores the kept ops and starts saving; again after close(), it starts saving again. */
        open(): Promise<void> {
            clearTimeout(teardown);
            teardown = undefined;
            closed();
            closed = () => {};
            if (phase === 'idle') {
                phase = 'loading';
                loading = load();
            } else if (phase === 'editable') begin();
            return loading;
        },
        /**
         * Stops saving at once, and lets go of the queue and the lock unless opened again in the same task;
         * settles once they are let go (the kept ops written), or at once when opened again.
         */
        close(): Promise<void> {
            client.stop();
            clearTimeout(teardown);
            closed();
            return new Promise<void>((resolve) => {
                closed = resolve;
                teardown = setTimeout(() => {
                    teardown = undefined;
                    closed = () => {};
                    void letGo().then(resolve);
                }, 0);
            });
        },
    };
}

export const browserDevice = (): Device => ({
    indexedDB: globalThis.indexedDB,
    locks: globalThis.navigator?.locks,
});

export type ReviewSession = ReturnType<typeof createReviewSession>;
