import { IDBFactory, IDBObjectStore as FDBObjectStore } from 'fake-indexeddb';
import { BATCH_MAX_OPS, type Op } from '../contract/generated/review-ops';
import { slotKey } from '../model/targetKey';
import { ev, makeBundle } from '../test/bundles';
import type { SentRequest } from '../test/fakeFetch';
import { fakeLocks } from '../test/fakeLocks';
import { fakeServer, type FakeServer } from '../test/fakeServer';
import type { OpBatch } from '../test/memoryBackend';
import { openDeviceQueue, QUEUE_VERSION, type StoredQueue } from './deviceQueue';
import {
    createReviewSession,
    NOT_KEPT,
    OTHER_TAB,
    UNKNOWN_VERSION,
    type Device,
    type ReviewSession,
} from './reviewSession';
import { KEPT_REFUSED } from './keptOps';
import { selectCanRedo, selectCanUndo, selectSaveLabel } from './sessionStore';
import type { ReviewStores } from './reviewStores';

const TEXT = 'Twenty patients performed a Stroop task during fMRI scanning.';
const at = (words: string): [number, number] => [TEXT.indexOf(words), TEXT.indexOf(words) + words.length];
const source = makeBundle({ description: ev('A study'), design: { description: ev('fMRI') } }, TEXT, {
    source: { ...makeBundle({}, '').source, id: 'S1', label: 'A paper' },
});

const networkDown = () => {
    throw new TypeError('Failed to fetch');
};

let server: FakeServer;
let indexedDB: IDBFactory;
let sessions: ReviewSession[];
let reviewId: string;

/** Lets the request reach the server, then loses its answer. */
const answerLost = async (request: SentRequest) => {
    server.backend.postOps(reviewId, request.body as OpBatch);
    return networkDown();
};

const posts = () => server.requests.filter((r) => r.method === 'POST');
const sentIds = () => posts().map((r) => (r.body as { ops: Op[] }).ops.map((op) => op.client_op_id));
const storedIds = async () => (await server.backend.getBundle('S1')).ops.map((s) => s.op.client_op_id);

/** A tab of the review over the shared IndexedDB, as a reload makes, not yet opened. */
async function newTab(device: Partial<Device> = {}) {
    const session = createReviewSession(await server.backend.getBundle('S1'), server.api(), {
        indexedDB,
        locks: undefined,
        ...device,
    });
    sessions.push(session);
    return session;
}

async function openTab(device: Partial<Device> = {}) {
    const session = await newTab(device);
    await session.open();
    return session;
}

function edit(stores: ReviewStores, path: string, words: string) {
    stores.view.getState().focusSlot(slotKey('study', path));
    expect(stores.session.getState().addEvidence(stores.view.getState().focus.key, at(words), 'new')).toBe(true);
    return stores.session.getState().pending.at(-1)!.client_op_id;
}

const setDescription = (id: string, value: string): Op => ({
    client_op_id: id,
    type: 'set_value',
    target: { kind: 'slot', entity: 'study', path: 'description' },
    value: { extraction_status: 'extracted', value },
});

const spanOf = (words: string) => ({ start_char: at(words)[0], end_char: at(words)[1] });

const evidence = (id: string, path: string, words: string): Op => ({
    client_op_id: id,
    type: 'set_evidence',
    target: { kind: 'slot', entity: 'study', path },
    evidence: { status: 'present', sets: [{ spans: [spanOf(words)] }] },
});

const notReported = (id: string): Op => ({
    client_op_id: id,
    type: 'set_value',
    target: { kind: 'slot', entity: 'study', path: 'description' },
    value: { extraction_status: 'not_reported', unreported_reason: 'ambiguous' },
});

/** A queue as this version keeps it, of one evidence edit made on last_seq 0. */
const keptEntry = async (): Promise<StoredQueue> => ({
    version: QUEUE_VERSION,
    review_id: reviewId,
    ops: [
        {
            client_op_id: 'kept-0001',
            type: 'set_evidence',
            target: { kind: 'slot', entity: 'study', path: 'description' },
            evidence: { status: 'present', sets: [{ spans: [spanOf('Twenty patients')] }] },
        },
    ],
    groupOf: {},
    intents: {},
    saved_at: new Date().toISOString(),
});

const setOnLine = (onLine: boolean) =>
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => onLine });

beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    server = fakeServer([source]);
    indexedDB = new IDBFactory();
    sessions = [];
    reviewId = (await server.backend.startReview('S1')).summary.id;
});

afterEach(async () => {
    sessions.forEach((s) => s.close());
    await vi.advanceTimersByTimeAsync(0);
    setOnLine(true);
    vi.useRealTimers();
    expect(server.invalid()).toEqual([]);
});

describe('the offline queue', () => {
    it('keeps edits made offline across a reload, and the new tab sends them', async () => {
        const first = await openTab();
        server.intercept(networkDown);
        server.intercept(networkDown);
        const a = edit(first.stores, 'description', 'Twenty patients');
        const b = edit(first.stores, 'design.description', 'during fMRI');
        await vi.advanceTimersByTimeAsync(1000);
        await first.client.settled();
        expect(first.stores.session.getState().save).toBe('offline');
        first.close();
        await first.client.settled();
        expect(await storedIds()).toEqual([]);

        const second = await openTab();
        await second.client.settled();
        expect(await storedIds()).toEqual([a, b]);
        expect(sentIds().slice(2)).toEqual([[a, b]]);
        expect(second.stores.session.getState().pending).toEqual([]);
        expect(second.stores.session.getState().record).toEqual((await server.backend.getBundle('S1')).record);
    });

    it('does not send again an op that reached the server before its answer was lost', async () => {
        const first = await openTab();
        server.intercept(answerLost);
        const a = edit(first.stores, 'description', 'Twenty patients');
        await vi.advanceTimersByTimeAsync(1000);
        await first.client.settled();
        server.intercept(networkDown);
        const b = edit(first.stores, 'design.description', 'during fMRI');
        await vi.advanceTimersByTimeAsync(250);
        expect(first.stores.session.getState().pending.map((op) => op.client_op_id)).toEqual([a, b]);
        first.close();
        await first.client.settled();
        expect(await storedIds()).toEqual([a]);

        const second = await openTab();
        await second.client.settled();
        expect(sentIds().slice(2)).toEqual([[b]]);
        expect(await storedIds()).toEqual([a, b]);
        expect(second.stores.session.getState().pending).toEqual([]);
    });

    it('sends one emitBatch intent as one batch after a reload, never split at the batch limit', async () => {
        const first = await openTab();
        server.intercept(networkDown);
        server.intercept(networkDown);
        const singles = Array.from({ length: BATCH_MAX_OPS - 1 }, (_, i) => `single-${i}`);
        singles.forEach((id) => expect(first.stores.session.getState().emit(setDescription(id, id))).toBe(true));
        const intent = [setDescription('intent-1', 'one'), setDescription('intent-2', 'two')];
        expect(first.stores.session.getState().emitBatch(intent)).toBe(true);
        await vi.advanceTimersByTimeAsync(1000);
        await first.client.settled();
        first.close();
        await first.client.settled();
        expect(sentIds()).toEqual([singles, singles]);

        const second = await openTab();
        await second.client.settled();
        expect(sentIds().slice(2)).toEqual([singles, ['intent-1', 'intent-2']]);
        expect(await storedIds()).toEqual([...singles, 'intent-1', 'intent-2']);
    });

    it('rebuilds a kept evidence edit on the record another tab changed since, keeping both spans', async () => {
        const first = await openTab();
        server.intercept(networkDown);
        server.intercept(networkDown);
        edit(first.stores, 'description', 'Twenty patients');
        await vi.advanceTimersByTimeAsync(1000);
        await first.client.settled();
        first.close();
        await first.client.settled();
        server.backend.postOps(reviewId, {
            expected_last_seq: 0,
            ops: [
                {
                    client_op_id: 'elsewhere',
                    type: 'set_evidence',
                    target: { kind: 'slot', entity: 'study', path: 'description' },
                    evidence: { status: 'present', sets: [{ spans: [spanOf('during fMRI')] }] },
                },
            ],
        });

        const second = await openTab();
        await second.client.settled();
        const { record } = await server.backend.getBundle('S1');
        expect((record as { description: { evidence: unknown } }).description.evidence).toEqual({
            status: 'present',
            sets: [
                { spans: [{ ...spanOf('during fMRI'), text: 'during fMRI' }] },
                { spans: [{ ...spanOf('Twenty patients'), text: 'Twenty patients' }] },
            ],
        });
    });

    it('blocks saving on kept edits the rebase refuses, sending nothing until they are undone', async () => {
        const first = await openTab();
        server.intercept(networkDown);
        server.intercept(networkDown);
        const refused = edit(first.stores, 'description', 'Twenty patients');
        const kept = edit(first.stores, 'design.description', 'during fMRI');
        await vi.advanceTimersByTimeAsync(1000);
        await first.client.settled();
        first.close();
        await first.client.settled();
        server.backend.postOps(reviewId, {
            expected_last_seq: 0,
            ops: [
                {
                    client_op_id: 'elsewhere',
                    type: 'set_value',
                    target: { kind: 'slot', entity: 'study', path: 'description' },
                    value: { extraction_status: 'not_reported', unreported_reason: 'ambiguous' },
                },
            ],
        });

        const second = await openTab();
        await vi.advanceTimersByTimeAsync(5000);
        await second.client.settled();
        const state = second.stores.session.getState();
        expect(posts()).toHaveLength(2);
        expect(state.pending.map((op) => op.client_op_id)).toEqual([refused, kept]);
        expect(state.blocked).toEqual({
            clientOpIds: [refused],
            problems: [expect.stringMatching(/^study description: .*set a value first/)],
            reason: KEPT_REFUSED,
        });
        expect(state.save).toBe('failed');
        expect(selectSaveLabel(state)).toBe(KEPT_REFUSED);
        expect(state.notices).toEqual([]);
        expect(state.record).toMatchObject({ description: { extraction_status: 'not_reported' } });

        await second.client.undoBlocked();
        expect(sentIds().slice(2)).toEqual([[kept]]);
        expect(await storedIds()).toEqual(['elsewhere', kept]);
        expect(second.stores.session.getState().pending).toEqual([]);
    });

    it('blocks the whole emitBatch group of a kept op the rebase refuses, though it does not open the group, and undoing drops the group only', async () => {
        const queue = await openDeviceQueue(indexedDB, () => {});
        await queue.write({
            ...(await keptEntry()),
            ops: [
                evidence('group-01', 'design.description', 'during fMRI'),
                evidence('group-02', 'description', 'Twenty patients'),
                evidence('alone-01', 'design.description', 'Stroop task'),
            ],
            groupOf: { 'group-01': 'group-01', 'group-02': 'group-01' },
        });
        server.backend.postOps(reviewId, {
            expected_last_seq: 0,
            ops: [
                {
                    client_op_id: 'elsewhere',
                    type: 'set_value',
                    target: { kind: 'slot', entity: 'study', path: 'description' },
                    value: { extraction_status: 'not_reported', unreported_reason: 'ambiguous' },
                },
            ],
        });

        const tab = await openTab();
        await tab.client.settled();
        expect(posts()).toHaveLength(0);
        expect(tab.stores.session.getState().blocked?.clientOpIds).toEqual(['group-01', 'group-02']);
        expect(tab.stores.session.getState().blocked?.problems).toHaveLength(1);
        await tab.client.undoBlocked();
        expect(sentIds()).toEqual([['alone-01']]);
        expect(tab.stores.session.getState().pending).toEqual([]);
    });

    it('drops a kept queue of an unknown version, with a notice, and sends none of it', async () => {
        const queue = await openDeviceQueue(indexedDB, () => {});
        await queue.write({
            ...(await keptEntry()),
            version: QUEUE_VERSION + 1,
        });

        const tab = await openTab();
        await vi.advanceTimersByTimeAsync(5000);
        await tab.client.settled();
        expect(posts()).toHaveLength(0);
        expect(tab.stores.session.getState().pending).toEqual([]);
        expect(tab.stores.session.getState().device).toBe('kept');
        expect(tab.stores.session.getState().deviceNotice).toBe(UNKNOWN_VERSION);
        expect(await queue.read(reviewId)).toBeUndefined();
    });

    const refusingOpen = {
        open: () => {
            throw new DOMException('The operation is insecure.', 'SecurityError');
        },
    };

    it.each([
        ['missing', undefined],
        ['throwing on open', refusingOpen as unknown as IDBFactory],
    ])('saves as before when IndexedDB is %s, with one notice that edits are not kept', async (_, factory) => {
        const tab = await openTab({ indexedDB: factory });
        expect(tab.stores.session.getState().device).toBe('memory');
        expect(tab.stores.session.getState().deviceNotice).toBe(NOT_KEPT);
        const a = edit(tab.stores, 'description', 'Twenty patients');
        await vi.advanceTimersByTimeAsync(1000);
        await tab.client.settled();
        expect(sentIds()).toEqual([[a]]);
        expect(tab.stores.session.getState().pending).toEqual([]);
        expect(selectSaveLabel(tab.stores.session.getState())).toBe('saved');
    });

    it('stops keeping edits when a write throws, with the notice, and saves as before', async () => {
        const put = vi.spyOn(FDBObjectStore.prototype, 'put').mockImplementation(() => {
            throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
        });
        const tab = await openTab();
        expect(tab.stores.session.getState().device).toBe('kept');
        server.intercept(networkDown);
        const a = edit(tab.stores, 'description', 'Twenty patients');
        await vi.advanceTimersByTimeAsync(250);
        expect(tab.stores.session.getState().device).toBe('memory');
        expect(tab.stores.session.getState().deviceNotice).toBe(NOT_KEPT);
        const b = edit(tab.stores, 'design.description', 'during fMRI');
        await vi.advanceTimersByTimeAsync(250);
        expect(put).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(2000);
        await tab.client.settled();
        expect(await storedIds()).toEqual([a, b]);
        expect(selectSaveLabel(tab.stores.session.getState())).toBe('saved');
    });

    it('opens a second tab without the lock read-only, leaving the kept queue alone', async () => {
        const { locks, asked } = fakeLocks();
        const open = vi.spyOn(indexedDB, 'open');
        const first = await openTab({ locks });
        server.intercept(networkDown);
        const a = edit(first.stores, 'description', 'Twenty patients');
        await vi.advanceTimersByTimeAsync(1000);
        await first.client.settled();

        const second = await newTab({ locks });
        void second.open();
        await vi.advanceTimersByTimeAsync(0);
        const state = () => second.stores.session.getState();
        expect(asked).toEqual([`neurostore-review:${reviewId}`, `neurostore-review:${reviewId}`]);
        expect(open).toHaveBeenCalledTimes(1);
        expect(state().device).toBe('readonly');
        expect(state().deviceNotice).toBe(OTHER_TAB);
        second.stores.view.getState().focusSlot(slotKey('study', 'design.description'));
        expect(state().addEvidence(second.stores.view.getState().focus.key, at('during fMRI'), 'new')).toBe(false);
        expect(state().emit(setDescription('second-1', 'two'))).toBe(false);
        expect(state().emitBatch([setDescription('second-2', 'two')])).toBe(false);
        expect(state().pending).toEqual([]);
        await vi.advanceTimersByTimeAsync(5000);
        await second.client.settled();
        expect(sentIds()).toEqual([[a], [a]]);
        expect(first.stores.session.getState().pending).toEqual([]);
        expect(await storedIds()).toEqual([a]);
    });

    it('changes no review state from the read-only tab', async () => {
        const { locks } = fakeLocks();
        await openTab({ locks });
        const second = await openTab({ locks });
        await second.client.changeState('submitted');
        expect(server.requests.filter((r) => r.method === 'PATCH')).toEqual([]);
        expect(second.stores.session.getState().bundle.review?.state).toBe('in_progress');
        expect((await server.backend.getBundle('S1')).review?.state).toBe('in_progress');
    });

    it('says the edits are saved on this device while a send fails for the network', async () => {
        const tab = await openTab();
        server.intercept(networkDown);
        edit(tab.stores, 'description', 'Twenty patients');
        await vi.advanceTimersByTimeAsync(1000);
        await tab.client.settled();
        expect(selectSaveLabel(tab.stores.session.getState())).toBe('offline; saved on this device');
        await vi.advanceTimersByTimeAsync(1000);
        await tab.client.settled();
        expect(selectSaveLabel(tab.stores.session.getState())).toBe('saved');
    });

    it('says offline while the browser is, from the start or from the offline event, until it is back', async () => {
        setOnLine(false);
        const tab = await openTab();
        expect(selectSaveLabel(tab.stores.session.getState())).toBe('offline; saved on this device');
        setOnLine(true);
        window.dispatchEvent(new Event('online'));
        await tab.client.settled();
        expect(selectSaveLabel(tab.stores.session.getState())).toBe('saved');
        setOnLine(false);
        window.dispatchEvent(new Event('offline'));
        expect(selectSaveLabel(tab.stores.session.getState())).toBe('offline; saved on this device');
    });

    it('says only offline when the edits are not kept on this device', async () => {
        const tab = await openTab({ indexedDB: undefined });
        setOnLine(false);
        window.dispatchEvent(new Event('offline'));
        expect(selectSaveLabel(tab.stores.session.getState())).toBe('offline');
    });

    it('keeps exactly the pending ops, their groups and intents, and deletes the entry once all are confirmed', async () => {
        const queue = await openDeviceQueue(indexedDB, () => {});
        const tab = await openTab();
        server.intercept(networkDown);
        const a = edit(tab.stores, 'description', 'Twenty patients');
        const intent = [setDescription('intent-1', 'one'), setDescription('intent-2', 'two')];
        expect(tab.stores.session.getState().emitBatch(intent)).toBe(true);
        await vi.advanceTimersByTimeAsync(249);
        expect(await queue.read(reviewId)).toBeUndefined();
        await vi.advanceTimersByTimeAsync(1);
        expect(await queue.read(reviewId)).toEqual({
            version: 1,
            review_id: reviewId,
            ops: tab.stores.session.getState().pending,
            groupOf: { 'intent-1': 'intent-1', 'intent-2': 'intent-1' },
            intents: {
                [a]: {
                    kind: 'add_span',
                    slot: slotKey('study', 'description'),
                    set_index: 'new',
                    span: spanOf('Twenty patients'),
                },
            },
            saved_at: new Date().toISOString(),
        });
        expect((await queue.read(reviewId))!.ops.map((op) => op.client_op_id)).toEqual([a, 'intent-1', 'intent-2']);
        await vi.advanceTimersByTimeAsync(750);
        await tab.client.settled();
        expect(await storedIds()).toEqual([]);
        await vi.advanceTimersByTimeAsync(1000);
        await tab.client.settled();
        expect(await storedIds()).toEqual([a, 'intent-1', 'intent-2']);
        expect(tab.stores.session.getState().pending).toEqual([]);
        await vi.advanceTimersByTimeAsync(250);
        expect(await queue.read(reviewId)).toBeUndefined();
    });

    it('writes at once when the page is hidden or hides, without waiting for the 250 ms', async () => {
        const queue = await openDeviceQueue(indexedDB, () => {});
        const tab = await openTab();
        server.intercept(networkDown);
        const a = edit(tab.stores, 'description', 'Twenty patients');
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
        document.dispatchEvent(new Event('visibilitychange'));
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
        expect((await queue.read(reviewId))?.ops.map((op) => op.client_op_id)).toEqual([a]);
        const b = edit(tab.stores, 'design.description', 'during fMRI');
        window.dispatchEvent(new Event('pagehide'));
        expect((await queue.read(reviewId))?.ops.map((op) => op.client_op_id)).toEqual([a, b]);
    });

    it('takes no edits until the kept ops are in pending, then sends them before the new edit', async () => {
        const queue = await openDeviceQueue(indexedDB, () => {});
        await queue.write(await keptEntry());
        const tab = await newTab();
        const opening = tab.open();
        const state = () => tab.stores.session.getState();
        expect(state().device).toBe('loading');
        expect(state().emit(setDescription('early-0001', 'early'))).toBe(false);
        await opening;
        expect(state().device).toBe('kept');
        expect(state().pending.map((op) => op.client_op_id)).toEqual(['kept-0001']);
        expect((state().record as { description: { evidence: unknown } }).description.evidence).toEqual({
            status: 'present',
            sets: [{ spans: [{ ...spanOf('Twenty patients'), text: 'Twenty patients' }] }],
        });
        expect(state().emit(setDescription('late-0001', 'late-0001'))).toBe(true);
        await tab.client.settled();
        await vi.advanceTimersByTimeAsync(1000);
        await tab.client.settled();
        expect(sentIds()).toEqual([['kept-0001'], ['late-0001']]);
    });
    it('keeps pending the kept ops rebuilt on the record when restoring blocks, so undoing keeps the other tab’s span', async () => {
        const first = await openTab();
        server.intercept(networkDown);
        server.intercept(networkDown);
        edit(first.stores, 'description', 'Twenty patients');
        const kept = edit(first.stores, 'design.description', 'during fMRI');
        await vi.advanceTimersByTimeAsync(1000);
        await first.client.settled();
        first.close();
        await first.client.settled();
        server.backend.postOps(reviewId, {
            expected_last_seq: 0,
            ops: [notReported('elsewhere'), evidence('elsewhere-2', 'design.description', 'Stroop task')],
        });

        const second = await openTab();
        await second.client.settled();
        await second.client.undoBlocked();
        expect(await storedIds()).toEqual(['elsewhere', 'elsewhere-2', kept]);
        const { record } = await server.backend.getBundle('S1');
        expect((record as { design: { description: { evidence: unknown } } }).design.description.evidence).toEqual({
            status: 'present',
            sets: [
                { spans: [{ ...spanOf('Stroop task'), text: 'Stroop task' }] },
                { spans: [{ ...spanOf('during fMRI'), text: 'during fMRI' }] },
            ],
        });
    });

    it('keeps an edit made offline just before the tab closes', async () => {
        const first = await openTab();
        server.intercept(networkDown);
        const a = edit(first.stores, 'description', 'Twenty patients');
        await vi.advanceTimersByTimeAsync(100);
        first.close();
        await vi.advanceTimersByTimeAsync(0);
        await first.client.settled();

        const second = await openTab();
        expect(second.stores.session.getState().pending.map((op) => op.client_op_id)).toEqual([a]);
        await second.client.settled();
        expect(await storedIds()).toEqual([a]);
    });

    it('writes once for every change to pending within 250 ms, and not for other changes', async () => {
        const put = vi.spyOn(FDBObjectStore.prototype, 'put');
        const tab = await openTab();
        server.intercept(networkDown);
        server.intercept(networkDown);
        edit(tab.stores, 'description', 'Twenty patients');
        await vi.advanceTimersByTimeAsync(100);
        edit(tab.stores, 'design.description', 'during fMRI');
        await vi.advanceTimersByTimeAsync(100);
        expect(tab.stores.session.getState().emit(setDescription('third-01', 'three'))).toBe(true);
        await vi.advanceTimersByTimeAsync(50);
        expect(put).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(2000);
        await tab.client.settled();
        expect(posts()).toHaveLength(2);
        expect(tab.stores.session.getState().save).toBe('offline');
        expect(put).toHaveBeenCalledTimes(1);
    });

    it('writes nothing on pagehide once the tab has closed', async () => {
        const tab = await openTab();
        server.intercept(networkDown);
        edit(tab.stores, 'description', 'Twenty patients');
        await vi.advanceTimersByTimeAsync(250);
        tab.close();
        await vi.advanceTimersByTimeAsync(0);
        await tab.client.settled();
        const put = vi.spyOn(FDBObjectStore.prototype, 'put');
        window.dispatchEvent(new Event('pagehide'));
        await vi.advanceTimersByTimeAsync(0);
        expect(put).not.toHaveBeenCalled();
    });

    it('opens editable, without the lock, where asking for the lock throws', async () => {
        const locks = {
            request: () => Promise.reject(new DOMException('The operation is insecure.', 'SecurityError')),
        } as unknown as LockManager;
        const tab = await openTab({ locks });
        expect(tab.stores.session.getState().device).toBe('kept');
        expect(tab.stores.session.getState().deviceNotice).toBe('');
        const a = edit(tab.stores, 'description', 'Twenty patients');
        await vi.advanceTimersByTimeAsync(1000);
        await tab.client.settled();
        expect(sentIds()).toEqual([[a]]);
    });

    it('drops a kept op the server already holds, blocking nothing, though it would now be refused', async () => {
        const [held] = (await keptEntry()).ops;
        server.backend.postOps(reviewId, { expected_last_seq: 0, ops: [held] });
        server.backend.postOps(reviewId, { expected_last_seq: 1, ops: [notReported('elsewhere')] });
        const queue = await openDeviceQueue(indexedDB, () => {});
        await queue.write(await keptEntry());

        const tab = await openTab();
        await vi.advanceTimersByTimeAsync(5000);
        await tab.client.settled();
        const state = tab.stores.session.getState();
        expect(state.blocked).toBeNull();
        expect(state.pending).toEqual([]);
        expect(posts()).toHaveLength(0);
        expect(selectSaveLabel(state)).toBe('saved');
    });

    it('saves, and retries, again when opened again after the load, as a StrictMode remount does', async () => {
        const tab = await openTab();
        tab.close();
        void tab.open();
        await vi.advanceTimersByTimeAsync(0);
        server.intercept(networkDown);
        const a = edit(tab.stores, 'description', 'Twenty patients');
        await vi.advanceTimersByTimeAsync(1000);
        await tab.client.settled();
        await vi.advanceTimersByTimeAsync(1000);
        await tab.client.settled();
        expect(sentIds()).toEqual([[a], [a]]);
        expect(await storedIds()).toEqual([a]);
    });

    it('sends nothing once closed before the load ends, though the load ends before the tab lets go', async () => {
        const queue = await openDeviceQueue(indexedDB, () => {});
        await queue.write(await keptEntry());
        const tab = await newTab();
        const opening = tab.open();
        tab.close();
        await opening;
        await vi.advanceTimersByTimeAsync(5000);
        await tab.client.settled();
        expect(posts()).toEqual([]);
        expect((await queue.read(reviewId))?.ops.map((op) => op.client_op_id)).toEqual(['kept-0001']);
    });

    it('keeps the lock across a close and open in one task, and lets go of it a task after a close', async () => {
        const { locks, held } = fakeLocks();
        const lock = `neurostore-review:${reviewId}`;
        const tab = await openTab({ locks });
        tab.close();
        void tab.open();
        await vi.advanceTimersByTimeAsync(0);
        expect([...held]).toEqual([lock]);
        expect((await openTab({ locks })).stores.session.getState().device).toBe('readonly');
        tab.close();
        expect([...held]).toEqual([lock]);
        await vi.advanceTimersByTimeAsync(0);
        expect([...held]).toEqual([]);
        expect((await openTab({ locks })).stores.session.getState().device).toBe('kept');
    });

    it('changes and sends nothing on undo, redo, a discard or a lifecycle change in the read-only tab', async () => {
        const { locks } = fakeLocks();
        await openTab({ locks });
        const second = await openTab({ locks });
        const { session } = second.stores;
        session.setState({
            pending: [setDescription('seeded-01', 'one'), setDescription('seeded-02', 'two')],
            undoStack: [{ ops: ['seeded-02'], inverses: {} }],
            redoStack: [{ ops: ['seeded-00'], inverses: { 'seeded-00': [{ ...setDescription('', 'zero') }] } }],
        });
        const seeded = session.getState();
        expect(selectCanUndo(seeded)).toBe(false);
        expect(selectCanRedo(seeded)).toBe(false);
        seeded.undo();
        seeded.redo();
        second.client.discardPending();
        seeded.setLifecycle('submitted');
        await second.client.flush();
        expect(session.getState()).toBe(seeded);
        expect(posts()).toEqual([]);
        session.setState({ blocked: { clientOpIds: ['seeded-01'], problems: ['refused'], reason: 'refused' } });
        const blocked = session.getState();
        await second.client.undoBlocked();
        await second.client.flush();
        expect(session.getState()).toBe(blocked);
        await vi.advanceTimersByTimeAsync(5000);
        expect(posts()).toEqual([]);
    });

    it('keeps only the kept ops’ groups and intents once restoring drops the stored ones and blocks', async () => {
        const intent = (path: string, words: string) => ({
            kind: 'add_span' as const,
            slot: slotKey('study', path),
            set_index: 'new' as const,
            span: spanOf(words),
        });
        const sent = [
            evidence('sent-01', 'design.description', 'during fMRI'),
            evidence('sent-02', 'design.description', 'Stroop task'),
        ];
        const refused = evidence('refused-01', 'description', 'Twenty patients');
        server.backend.postOps(reviewId, { expected_last_seq: 0, ops: sent });
        server.backend.postOps(reviewId, { expected_last_seq: 2, ops: [notReported('elsewhere')] });
        const queue = await openDeviceQueue(indexedDB, () => {});
        await queue.write({
            ...(await keptEntry()),
            ops: [...sent, refused],
            groupOf: { 'sent-01': 'sent-01', 'sent-02': 'sent-01' },
            intents: {
                'sent-01': intent('design.description', 'during fMRI'),
                'refused-01': intent('description', 'Twenty patients'),
            },
        });

        const tab = await openTab();
        expect(tab.stores.session.getState().blocked?.clientOpIds).toEqual(['refused-01']);
        window.dispatchEvent(new Event('pagehide'));
        expect(await queue.read(reviewId)).toEqual({
            version: 1,
            review_id: reviewId,
            ops: [refused],
            groupOf: {},
            intents: { 'refused-01': intent('description', 'Twenty patients') },
            saved_at: new Date().toISOString(),
        });
    });
});
