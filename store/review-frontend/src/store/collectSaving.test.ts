import { IDBFactory } from 'fake-indexeddb';
import type { Op } from '../contract/generated/review-ops';
import { currentAnalyses, type CoordinatePoint } from '../model/coordinates';
import { coordinateBundle, FACES, HOUSES, INSULA, PRECUNEUS } from '../test/coordinates';
import { fakeServer, type FakeServer } from '../test/fakeServer';
import { COLLECT_PAUSE_MS, createOpClient, type OpClient } from './opClient';
import { json } from '../test/fakeFetch';
import { openDeviceQueue, QUEUE_VERSION } from './deviceQueue';
import { KEPT_EDITS } from './pointEdits';
import { createReviewSession } from './reviewSession';
import { createReviewStores, type ReviewStores } from './reviewStores';
import { selectIsEditable, selectSaveLabel, selectShownPoints } from './sessionStore';

const at = (point: CoordinatePoint, z: number): CoordinatePoint => ({
    ...point,
    coordinates: [point.coordinates[0], point.coordinates[1], z],
});

let server: FakeServer;
let client: OpClient;
let stores: ReviewStores;

beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    server = fakeServer([coordinateBundle({ review: null })]);
    await server.backend.startReview('P1');
    stores = createReviewStores(await server.backend.getBundle('P1'), { now: () => 'now' });
    client = createOpClient(stores.session, server.api());
    client.start();
});

afterEach(async () => {
    client.stop();
    await vi.advanceTimersByTimeAsync(0);
    vi.useRealTimers();
    expect(server.invalid()).toEqual([]);
});

const posted = () => server.requests.filter((r) => r.method === 'POST').map((r) => (r.body as { ops: Op[] }).ops);
const pointsSent = (ops: Op[]) => ops.map((op) => (op as { payload: { points: CoordinatePoint[] } }).payload.points);
const facesNow = () => currentAnalyses(stores.session.getState().bundle).find((a) => a.name === FACES.name)!;
const collect = (points: CoordinatePoint[]) => stores.session.getState().collect(facesNow().key, points);

/** Holds back the next op batch until the returned function is called. */
function holdBatch() {
    let release = () => {};
    const released = new Promise<void>((resolve) => (release = resolve));
    server.intercept(async () => {
        await released;
        return undefined;
    });
    return release;
}

describe('point edits are saved after a pause in editing', () => {
    it('sends nothing while edits come quickly, then one batch with the final points after the pause', async () => {
        const edits = [41, 42, 43].map((z) => [at(PRECUNEUS, z), INSULA]);
        for (const points of edits) {
            collect(points);
            await vi.advanceTimersByTimeAsync(COLLECT_PAUSE_MS - 100);
        }
        expect(posted()).toEqual([]);
        await vi.advanceTimersByTimeAsync(100);
        await client.settled();
        expect(posted().map(pointsSent)).toEqual([[edits[2]]]);
        expect(facesNow().points).toEqual(edits[2]);
    });

    it('starts a new batch for an edit after the pause', async () => {
        collect([at(PRECUNEUS, 41), INSULA]);
        await vi.advanceTimersByTimeAsync(COLLECT_PAUSE_MS);
        await client.settled();
        collect([at(PRECUNEUS, 41), at(INSULA, 3)]);
        await vi.advanceTimersByTimeAsync(COLLECT_PAUSE_MS);
        await client.settled();
        expect(posted().map(pointsSent)).toEqual([[[at(PRECUNEUS, 41), INSULA]], [[at(PRECUNEUS, 41), at(INSULA, 3)]]]);
    });

    it.each([
        ['the window loses focus', () => window.dispatchEvent(new Event('blur'))],
        [
            'the page is hidden',
            () => {
                Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
                document.dispatchEvent(new Event('visibilitychange'));
            },
        ],
    ])('sends at once when %s', async (_, leave) => {
        collect([at(PRECUNEUS, 41), INSULA]);
        leave();
        await vi.advanceTimersByTimeAsync(0);
        await client.settled();
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
        expect(posted().map(pointsSent)).toEqual([[[at(PRECUNEUS, 41), INSULA]]]);
    });

    it('sends what is collected while a batch is out once that batch lands, after it and on its new key', async () => {
        const release = holdBatch();
        collect([at(PRECUNEUS, 41), INSULA]);
        await vi.advanceTimersByTimeAsync(COLLECT_PAUSE_MS);
        expect(posted()).toHaveLength(1);
        collect([at(PRECUNEUS, 41), at(INSULA, 3)]);
        collect([at(PRECUNEUS, 41), at(INSULA, 4)]);
        await vi.advanceTimersByTimeAsync(COLLECT_PAUSE_MS);
        expect(posted()).toHaveLength(1);
        expect(selectShownPoints(stores.session.getState(), FACES.key)).toEqual([at(PRECUNEUS, 41), at(INSULA, 4)]);
        release();
        await vi.advanceTimersByTimeAsync(0);
        await client.settled();
        expect(posted().map(pointsSent)).toEqual([[[at(PRECUNEUS, 41), INSULA]], [[at(PRECUNEUS, 41), at(INSULA, 4)]]]);
        const [, second] = posted();
        expect((second[0] as { target: { analysis_key: string } }).target.analysis_key).not.toBe(FACES.key);
        expect(facesNow().points).toEqual([at(PRECUNEUS, 41), at(INSULA, 4)]);
        expect(stores.session.getState().pending).toEqual([]);
    });

    it('sends what is collected on a flush', async () => {
        collect([at(PRECUNEUS, 41), INSULA]);
        await client.flush();
        expect(posted().map(pointsSent)).toEqual([[[at(PRECUNEUS, 41), INSULA]]]);
    });

    it('sends an edit to another analysis behind the batch out, in its own batch', async () => {
        const release = holdBatch();
        collect([at(PRECUNEUS, 41), INSULA]);
        await vi.advanceTimersByTimeAsync(COLLECT_PAUSE_MS);
        stores.session.getState().collect(HOUSES.key, [INSULA]);
        await vi.advanceTimersByTimeAsync(COLLECT_PAUSE_MS);
        expect(stores.session.getState().pending).toHaveLength(2);
        release();
        await vi.advanceTimersByTimeAsync(0);
        await client.settled();
        expect(posted().map(pointsSent)).toEqual([[[at(PRECUNEUS, 41), INSULA]], [[INSULA]]]);
    });
});

const networkDown = () => {
    throw new TypeError('Failed to fetch');
};

describe('point edits not yet sent when the tab closes', () => {
    let indexedDB: IDBFactory;
    const tab = async () => {
        const session = createReviewSession(await server.backend.getBundle('P1'), server.api(), {
            indexedDB,
            locks: undefined,
        });
        await session.open();
        return session;
    };
    const kept = async () =>
        (await openDeviceQueue(indexedDB, () => {})).read(stores.session.getState().bundle.review!.id);
    beforeEach(() => {
        indexedDB = new IDBFactory();
    });

    it('are kept on the device when the tab closes offline, and the next tab shows and sends them', async () => {
        const first = await tab();
        const edited = [at(PRECUNEUS, 41), INSULA];
        first.stores.session.getState().collect(FACES.key, edited);
        server.intercept(networkDown);
        first.close();
        await vi.advanceTimersByTimeAsync(0);
        await first.client.settled();
        expect(posted()).toEqual([edited].map(() => [expect.objectContaining({ action: 'edit_points' })]));

        const second = await tab();
        expect(selectShownPoints(second.stores.session.getState(), FACES.key)).toEqual(edited);
        await vi.advanceTimersByTimeAsync(0);
        await second.client.settled();
        expect(posted().map(pointsSent).at(-1)).toEqual([edited]);
        expect(facesNow.call(null) && (await server.backend.getBundle('P1')).ops).toHaveLength(1);
        second.close();
    });

    it('follow the analysis to the key a batch whose answer was lost gave it, on the next tab', async () => {
        const first = await tab();
        const reviewId = first.stores.session.getState().bundle.review!.id;
        server.intercept(async (request) => {
            server.backend.postOps(reviewId, request.body as never);
            throw new TypeError('Failed to fetch');
        });
        first.stores.session.getState().collect(FACES.key, [at(PRECUNEUS, 41), INSULA]);
        await vi.advanceTimersByTimeAsync(COLLECT_PAUSE_MS);
        await first.client.settled();
        const later = [at(PRECUNEUS, 41), at(INSULA, 3)];
        first.stores.session.getState().collect(FACES.key, later);
        server.intercept(networkDown);
        server.intercept(networkDown);
        first.close();
        await vi.advanceTimersByTimeAsync(0);
        await first.client.settled();
        const before = posted().length;

        const second = await tab();
        await vi.advanceTimersByTimeAsync(0);
        await second.client.settled();
        const [lost] = (await server.backend.getBundle('P1')).ops;
        const made = (lost.after as { analyses: { analysis: { key: string } }[] }).analyses[0].analysis.key;
        expect(posted().slice(before)).toEqual([
            [
                expect.objectContaining({
                    target: { kind: 'coordinate_analysis', analysis_key: made },
                    payload: { points: later },
                }),
            ],
        ]);
        second.close();
    });

    it('replay a split queued behind a batch whose answer was lost on the key that batch gave', async () => {
        const first = await tab();
        const reviewId = first.stores.session.getState().bundle.review!.id;
        server.intercept(async (request) => {
            server.backend.postOps(reviewId, request.body as never);
            throw new TypeError('Failed to fetch');
        });
        first.stores.session.getState().collect(FACES.key, [at(PRECUNEUS, 41), INSULA]);
        await vi.advanceTimersByTimeAsync(COLLECT_PAUSE_MS);
        await first.client.settled();
        const split: Op = {
            client_op_id: 'op-split',
            type: 'coordinate',
            target: { kind: 'coordinate_analysis', analysis_key: FACES.key },
            action: 'split',
            payload: { parts: [{ indices: [0] }, { indices: [1] }] },
        };
        first.stores.session.getState().emitBatch([split]);
        server.intercept(networkDown);
        server.intercept(networkDown);
        first.close();
        await vi.advanceTimersByTimeAsync(0);
        await first.client.settled();
        const before = posted().length;

        const second = await tab();
        await vi.advanceTimersByTimeAsync(0);
        await second.client.settled();
        const [lost, splitStored] = (await server.backend.getBundle('P1')).ops;
        const made = (lost.after as { analyses: { analysis: { key: string } }[] }).analyses[0].analysis.key;
        const aimed = { ...split, target: { kind: 'coordinate_analysis', analysis_key: made } };
        expect(posted().slice(before)).toEqual([[aimed]]);
        expect(splitStored.op).toEqual(aimed);
        second.close();
    });

    it('are moved into pending before the device is written when the page is hidden', async () => {
        const first = await tab();
        first.stores.session.getState().collect(FACES.key, [at(PRECUNEUS, 41), INSULA]);
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
        document.dispatchEvent(new Event('visibilitychange'));
        await vi.advanceTimersByTimeAsync(0);
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
        const entry = await kept();
        expect(entry?.collected).toBeUndefined();
        expect(entry?.ops).toEqual([expect.objectContaining({ action: 'edit_points' })]);
        first.close();
    });

    it('count as sent when the analysis already holds exactly their points', async () => {
        const reviewId = stores.session.getState().bundle.review!.id;
        const edited = [at(PRECUNEUS, 41), INSULA];
        const queue = await openDeviceQueue(indexedDB, () => {});
        server.backend.postOps(reviewId, {
            expected_last_seq: 0,
            ops: [
                {
                    client_op_id: 'op-sent-0001',
                    type: 'coordinate',
                    target: { kind: 'coordinate_analysis', analysis_key: FACES.key },
                    action: 'edit_points',
                    payload: { points: edited },
                } as Op,
            ],
        });
        await queue.write({
            version: QUEUE_VERSION,
            review_id: reviewId,
            ops: [],
            groupOf: {},
            intents: {},
            collected: [{ key: FACES.key, name: FACES.name, base: FACES.points!, points: edited }],
            saved_at: 'then',
        });
        const second = await tab();
        expect(second.stores.session.getState().collected).toEqual([]);
        expect(second.stores.session.getState().notices).toEqual([]);
        await vi.advanceTimersByTimeAsync(0);
        expect(posted()).toEqual([]);
        second.close();
    });

    it('that cannot follow their analysis are kept, named, unsaved, never sent, and Discard lets the tab go', async () => {
        const reviewId = stores.session.getState().bundle.review!.id;
        const queue = await openDeviceQueue(indexedDB, () => {});
        await queue.write({
            version: QUEUE_VERSION,
            review_id: reviewId,
            ops: [],
            groupOf: {},
            intents: {},
            collected: [
                { key: 'analysis#gone', name: 'Faces > Houses, as edited', base: [INSULA], points: [PRECUNEUS] },
            ],
            saved_at: 'then',
        });
        const second = await tab();
        const session = second.stores.session;
        expect(session.getState().notices).toEqual([
            { kind: 'kept', slot: 'Faces > Houses, as edited', message: KEPT_EDITS },
        ]);
        expect(selectSaveLabel(session.getState())).toBe('1 unsaved');
        await vi.advanceTimersByTimeAsync(COLLECT_PAUSE_MS);
        await second.client.settled();
        expect(posted()).toEqual([]);
        expect(unload()).toBe(true);
        session.getState().discardCollected('analysis#gone');
        expect(unload()).toBe(false);
        second.close();
    });

    it('of a queue an earlier version kept, with no collected edits, are restored with its ops', async () => {
        const reviewId = stores.session.getState().bundle.review!.id;
        const queue = await openDeviceQueue(indexedDB, () => {});
        const op = {
            client_op_id: 'op-old-0001',
            type: 'coordinate',
            target: { kind: 'coordinate_analysis', analysis_key: FACES.key },
            action: 'edit_points',
            payload: { points: [INSULA] },
        } as Op;
        await queue.write({ version: 1, review_id: reviewId, ops: [op], groupOf: {}, intents: {}, saved_at: 'then' });
        const second = await tab();
        await vi.advanceTimersByTimeAsync(0);
        await second.client.settled();
        expect(posted()).toEqual([[op]]);
        expect(second.stores.session.getState().deviceNotice).toBe('');
        second.close();
    });
});

/** Fires beforeunload, and says whether the page asked the browser to confirm leaving. */
const unload = () => {
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
};

describe('leaving the review with point edits collected', () => {
    it('sends them before unload, asking the browser to confirm while they save', async () => {
        collect([at(PRECUNEUS, 41), INSULA]);
        expect(unload()).toBe(true);
        expect(stores.session.getState().collected).toEqual([]);
        await vi.advanceTimersByTimeAsync(0);
        await client.settled();
        expect(posted().map(pointsSent)).toEqual([[[at(PRECUNEUS, 41), INSULA]]]);
        expect(unload()).toBe(false);
    });

    it('sends them before Submit moves the review on', async () => {
        collect([at(PRECUNEUS, 41), INSULA]);
        await client.changeState('submitted');
        expect(server.requests.map((r) => r.method).filter((m) => m !== 'GET')).toEqual(['POST', 'PATCH']);
        expect(posted().map(pointsSent)).toEqual([[[at(PRECUNEUS, 41), INSULA]]]);
        expect(stores.session.getState().bundle.review?.state).toBe('submitted');
    });

    it('blocks Submit and Set aside, saying why, while edits the server refused are kept', async () => {
        server.intercept((request) => {
            const [op] = (request.body as { ops: Op[] }).ops;
            return json(
                {
                    status: 422,
                    title: 'Unprocessable Entity',
                    detail: 'op 0 is refused',
                    errors: [
                        {
                            field: 'ops/0',
                            code: 'REJECTED',
                            message: 'no',
                            context: { op_index: 0, client_op_id: op.client_op_id },
                        },
                    ],
                },
                422
            );
        });
        collect([at(PRECUNEUS, 41), INSULA]);
        collect([at(PRECUNEUS, 42), INSULA]);
        await client.flush();
        const reason = '1 point edit on Faces > Houses is not saved: resolve them first';
        await expect(client.changeState('submitted')).rejects.toThrow(reason);
        await expect(client.changeState('set_aside', { reason: 'other', note: 'x' })).rejects.toThrow(reason);
        expect(server.requests.some((r) => r.method === 'PATCH')).toBe(false);
        expect(stores.session.getState().bundle.review?.state).toBe('in_progress');
        expect(selectIsEditable(stores.session.getState())).toBe(true);
    });
});

describe('a flush that comes as the save loop ends', () => {
    it('is not lost: the edit it was asked for goes out', async () => {
        const name = (client_op_id: string, value: string): Op => ({
            client_op_id,
            type: 'set_value',
            target: { kind: 'slot', entity: 'ana_houses', path: 'name' },
            value: { extraction_status: 'extracted', value, value_source: 'reported' },
        });
        const release = holdBatch();
        stores.session.getState().emit(name('op-a-0001', 'A'));
        await vi.advanceTimersByTimeAsync(1000);
        expect(posted()).toHaveLength(1);
        stores.session.getState().emit(name('op-b-0001', 'B'));
        const unsubscribe = stores.session.subscribe((next, previous) => {
            if (previous.save === 'saving' && next.save === 'idle') window.dispatchEvent(new Event('blur'));
        });
        release();
        await vi.advanceTimersByTimeAsync(0);
        await client.settled();
        unsubscribe();
        expect(posted().map((ops) => ops.map((op) => op.client_op_id))).toEqual([['op-a-0001'], ['op-b-0001']]);
    });
});
