import type { Op, SetEvidenceOp } from '../contract/generated/review-ops';
import { ApiError } from '../api/reviewApi';
import { ev, makeBundle } from '../test/bundles';
import { json } from '../test/fakeFetch';
import { fakeServer, type FakeServer } from '../test/fakeServer';
import { createOpClient, type OpClient } from './opClient';
import { createReviewStore, selectSaveLabel, type ReviewStore } from './reviewStore';
import { slotKey } from '../model/targetKey';

const TEXT = 'Twenty patients performed a Stroop task during fMRI scanning.';
const at = (words: string): [number, number] => [TEXT.indexOf(words), TEXT.indexOf(words) + words.length];
const source = makeBundle({ description: ev('A study'), design: { description: ev('fMRI') } }, TEXT, {
    source: { ...makeBundle({}, '').source, id: 'S1', label: 'A paper' },
});

const posts = (server: FakeServer) => server.requests.filter((r) => r.method === 'POST');
const sentIds = (server: FakeServer) =>
    posts(server).map((r) => (r.body as { ops: Op[] }).ops.map((op) => op.client_op_id));
const evidenceAt = (store: ReviewStore, field: 'description' | 'design') => {
    const record = store.getState().record as Record<
        string,
        { evidence?: unknown; description?: { evidence: unknown } }
    >;
    return field === 'design' ? record.design.description?.evidence : record.description.evidence;
};

function edit(store: ReviewStore, path: string, words: string, mode: 'first' | 'new' = 'new') {
    store.getState().focusSlot(slotKey('study', path));
    expect(store.getState().addEvidence(at(words), mode)).toBe(true);
}

const evidenceOp = (id: string, path: string, words: string): SetEvidenceOp => ({
    client_op_id: id,
    type: 'set_evidence',
    target: { kind: 'slot', entity: 'study', path },
    evidence: { status: 'present', sets: [{ spans: [{ start_char: at(words)[0], end_char: at(words)[1] }] }] },
});

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((r) => (resolve = r));
    return { promise, resolve };
}

const networkDown = () => {
    throw new TypeError('Failed to fetch');
};

let server: FakeServer;
let clients: OpClient[];

async function open(onServer = server) {
    const review = (await onServer.backend.startReview('S1')).summary;
    const store = createReviewStore(await onServer.backend.getBundle('S1'));
    const client = createOpClient(store, onServer.api());
    client.start();
    clients.push(client);
    return { store, client, review };
}

function setVisibility(state: 'hidden' | 'visible') {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
    document.dispatchEvent(new Event('visibilitychange'));
}

beforeEach(() => {
    vi.useFakeTimers();
    server = fakeServer([source]);
    clients = [];
});

afterEach(() => {
    clients.forEach((c) => c.stop());
    setVisibility('visible');
    vi.useRealTimers();
    expect(server.invalid()).toEqual([]);
});

describe('the save loop', () => {
    it('sends 1 s after the last edit, as one batch', async () => {
        const { store, client } = await open();
        edit(store, 'description', 'Twenty patients');
        await vi.advanceTimersByTimeAsync(600);
        edit(store, 'design.description', 'during fMRI');
        await vi.advanceTimersByTimeAsync(900);
        expect(posts(server)).toHaveLength(0);
        expect(selectSaveLabel(store.getState())).toBe('2 unsaved');
        await vi.advanceTimersByTimeAsync(100);
        await client.settled();
        expect(sentIds(server)).toEqual([store.getState().ops.map((s) => s.op.client_op_id)]);
        expect(store.getState().pending).toEqual([]);
        expect(selectSaveLabel(store.getState())).toBe('saved');
        expect(posts(server)[0].body).toMatchObject({ expected_last_seq: 0 });
    });

    it('sends at most 500 ops a batch', async () => {
        const { store, client } = await open();
        const ops = Array.from({ length: 1200 }, (_, i) =>
            evidenceOp(`op-${String(i).padStart(6, '0')}`, 'description', i % 2 ? 'Stroop' : 'fMRI')
        );
        store.setState({ pending: ops });
        await vi.advanceTimersByTimeAsync(1000);
        await client.settled();
        expect(sentIds(server).map((ids) => ids.length)).toEqual([500, 500, 200]);
        expect(posts(server).map((r) => (r.body as { expected_last_seq: number }).expected_last_seq)).toEqual([
            0, 500, 1000,
        ]);
        expect(store.getState().bundle.review?.last_seq).toBe(1200);
    });

    it('stays saving across batches, going idle once at the end', async () => {
        const { store, client } = await open();
        const changes: string[] = [];
        store.subscribe((next, previous) => {
            if (next.save !== previous.save) changes.push(next.save);
        });
        store.setState({
            pending: Array.from({ length: 1200 }, (_, i) =>
                evidenceOp(`op-${String(i).padStart(6, '0')}`, 'description', i % 2 ? 'Stroop' : 'fMRI')
            ),
        });
        await vi.advanceTimersByTimeAsync(1000);
        await client.settled();
        expect(changes).toEqual(['saving', 'idle']);
    });

    it('flushes at once, with keepalive, when the page is hidden', async () => {
        const { store, client } = await open();
        edit(store, 'description', 'Twenty patients');
        setVisibility('hidden');
        await client.settled();
        expect(posts(server)).toMatchObject([{ keepalive: true }]);
        expect(store.getState().pending).toEqual([]);
    });

    it('flushes at once on blur and when stopped by navigation', async () => {
        const { store, client } = await open();
        edit(store, 'description', 'Twenty patients');
        window.dispatchEvent(new Event('blur'));
        await client.settled();
        expect(posts(server)).toMatchObject([{ keepalive: false }]);
        edit(store, 'design.description', 'during fMRI');
        client.stop();
        await client.settled();
        expect(posts(server)).toHaveLength(2);
        expect(store.getState().pending).toEqual([]);
    });

    it('warns before unload only while ops are unsaved', async () => {
        const { store, client } = await open();
        const unload = () => {
            const event = new Event('beforeunload', { cancelable: true });
            window.dispatchEvent(event);
            return event.defaultPrevented;
        };
        expect(unload()).toBe(false);
        edit(store, 'description', 'Twenty patients');
        expect(unload()).toBe(true);
        await client.flush();
        expect(unload()).toBe(false);
    });
});

it('asks the browser to confirm an unload while ops are unsaved', async () => {
    const { store, client } = await open();
    const unload = () => Object.assign(new Event('beforeunload', { cancelable: true }), { preventDefault: vi.fn() });
    const idle = unload();
    window.dispatchEvent(idle);
    expect(idle.preventDefault).not.toHaveBeenCalled();
    edit(store, 'description', 'Twenty patients');
    const unsaved = unload();
    window.dispatchEvent(unsaved);
    expect(unsaved.preventDefault).toHaveBeenCalledTimes(1);
    await client.flush();
});

it('does not flush when the page becomes visible again', async () => {
    const { store, client } = await open();
    edit(store, 'description', 'Twenty patients');
    setVisibility('visible');
    await client.settled();
    expect(posts(server)).toHaveLength(0);
    expect(store.getState().pending).toHaveLength(1);
});

it('after stop() ignores blur, hiding and unload', async () => {
    const { store, client } = await open();
    client.stop();
    await client.settled();
    edit(store, 'description', 'Twenty patients');
    window.dispatchEvent(new Event('blur'));
    setVisibility('hidden');
    await client.settled();
    expect(posts(server)).toHaveLength(0);
    expect(store.getState().pending).toHaveLength(1);
});

describe('a 200', () => {
    it('takes the server’s documents and re-applies the ops made while the batch was out', async () => {
        const { store, client } = await open();
        const reply = deferred<void>();
        server.intercept(async (request) => {
            await reply.promise;
            const answer = server.backend.postOps('review-1', request.body as never);
            return json({
                ...answer,
                provenance: { [slotKey('study', 'description')]: { state: 'verified', user_id: 'me', at: 'now' } },
                hidden: { analyses: ['an_x'], entities: [] },
            });
        });
        edit(store, 'description', 'Twenty patients');
        const saving = client.flush();
        expect(selectSaveLabel(store.getState())).toBe('saving');
        edit(store, 'design.description', 'during fMRI');
        const later = store.getState().pending[1];
        reply.resolve();
        await saving;
        const state = store.getState();
        expect(sentIds(server)).toEqual([[expect.any(String)]]);
        expect(state.pending).toEqual([later]);
        expect(state.bundle.review).toMatchObject({ last_seq: 1 });
        expect(state.bundle.review?.provenance).toHaveProperty([slotKey('study', 'description')]);
        expect(state.bundle.hidden.analyses).toEqual(['an_x']);
        expect(evidenceAt(store, 'description')).toMatchObject({ status: 'present' });
        expect(evidenceAt(store, 'design')).toEqual(later.type === 'set_evidence' && later.evidence);
        expect(state.index.slot(slotKey('study', 'design.description'))?.value?.evidence).toEqual(
            later.type === 'set_evidence' && later.evidence
        );
        await vi.advanceTimersByTimeAsync(1000);
        await client.settled();
        expect(sentIds(server)[1]).toEqual([later.client_op_id]);
    });

    it('takes the server’s annotations and coordinate_revision', async () => {
        const { store, client } = await open();
        const annotations = { an_1: { note: 'checked against the table' } };
        const coordinate_revision = { header: { artifact_kind: 'coordinate_parse' }, analyses: [] };
        server.intercept(async (request) => {
            const answer = server.backend.postOps('review-1', request.body as never);
            return json({ ...answer, annotations, coordinate_revision });
        });
        edit(store, 'description', 'Twenty patients');
        await client.flush();
        expect(store.getState().bundle.review?.annotations).toEqual(annotations);
        expect(store.getState().bundle.coordinate_revision).toEqual(coordinate_revision);
    });
});

describe('a 200 reconciles the view', () => {
    it('reads only the slots its own ops and the pending ones touch, keeping the other slot nodes', async () => {
        const { store, client } = await open();
        const untouched = slotKey('study', 'design.description');
        const before = store.getState().index.slot(untouched);
        edit(store, 'description', 'Twenty patients');
        await client.flush();
        expect(store.getState().index.slot(untouched)).toBe(before);
        expect(store.getState().index.slot(slotKey('study', 'description'))?.value?.evidence).toMatchObject({
            status: 'present',
        });
    });
});

describe('submitting', () => {
    it('waits for the pending ops to be saved before it changes the state', async () => {
        const { store, client, review } = await open();
        const reply = deferred<void>();
        server.intercept(async (request) => {
            await reply.promise;
            return json(server.backend.postOps(review.id, request.body as never));
        });
        edit(store, 'description', 'Twenty patients');
        const changing = client.changeState('submitted');
        await vi.advanceTimersByTimeAsync(0);
        expect(server.requests.map((r) => r.method)).toEqual(['POST']);
        reply.resolve();
        await changing;
        expect(server.requests.map((r) => r.method)).toEqual(['POST', 'PATCH']);
        expect(store.getState().pending).toEqual([]);
    });

    it('resumes saving when the review is reopened', async () => {
        const { store, client } = await open();
        await client.changeState('submitted');
        edit(store, 'description', 'Twenty patients');
        await vi.advanceTimersByTimeAsync(1000);
        expect(posts(server)).toHaveLength(0);
        await client.changeState('in_progress');
        await client.settled();
        expect(posts(server)).toHaveLength(1);
        expect(store.getState().pending).toEqual([]);
        expect(store.getState().save).toBe('idle');
    });
});

describe('a 409', () => {
    it('with last_seq rebases the pending ops on the fresh bundle and resends them', async () => {
        const { store, client, review } = await open();
        server.backend.postOps(review.id, {
            expected_last_seq: 0,
            ops: [evidenceOp('tab2-0001', 'description', 'Stroop')],
        });
        edit(store, 'design.description', 'during fMRI');
        await client.flush();
        expect(server.requests.map((r) => `${r.method} ${r.path}`)).toEqual([
            'POST /api/review/reviews/review-1/ops',
            'GET /api/review/sources/S1/bundle',
            'POST /api/review/reviews/review-1/ops',
        ]);
        expect(posts(server).map((r) => (r.body as { expected_last_seq: number }).expected_last_seq)).toEqual([0, 1]);
        expect(store.getState().pending).toEqual([]);
        expect(store.getState().notices).toEqual([]);
        const fresh = await server.backend.getBundle('S1');
        expect(store.getState().record).toEqual(fresh.record);
        expect(store.getState().ops).toEqual(fresh.ops);
    });

    it('drops a pending op that no longer applies, names its slot, and resends the rest', async () => {
        const { store, client, review } = await open();
        server.backend.postOps(review.id, {
            expected_last_seq: 0,
            ops: [
                {
                    client_op_id: 'tab2-0001',
                    type: 'set_value',
                    target: { kind: 'slot', entity: 'study', path: 'description' },
                    value: { extraction_status: 'not_reported', unreported_reason: 'ambiguous' },
                },
            ],
        });
        edit(store, 'description', 'Twenty patients');
        edit(store, 'design.description', 'during fMRI');
        const [, kept] = store.getState().pending;
        await client.flush();
        expect(sentIds(server)[1]).toEqual([kept.client_op_id]);
        expect(store.getState().pending).toEqual([]);
        expect(store.getState().notices).toEqual([
            { kind: 'conflict', slot: 'study description', message: expect.stringContaining('set a value first') },
        ]);
        expect(store.getState().record).toMatchObject({ description: { extraction_status: 'not_reported' } });
    });

    it('after a partial replay sends only the new op, once the stored one is in the fresh bundle', async () => {
        const { store, client, review } = await open();
        edit(store, 'description', 'Twenty patients');
        const [stored] = store.getState().pending;
        server.backend.postOps(review.id, { expected_last_seq: 0, ops: [stored] });
        edit(store, 'design.description', 'during fMRI');
        const [, fresh] = store.getState().pending;
        await client.flush();
        expect(server.requests.map((r) => `${r.method} ${r.path}`)).toEqual([
            'POST /api/review/reviews/review-1/ops',
            'GET /api/review/sources/S1/bundle',
            'POST /api/review/reviews/review-1/ops',
        ]);
        expect(sentIds(server)).toEqual([[stored.client_op_id, fresh.client_op_id], [fresh.client_op_id]]);
        expect(posts(server)[1].body).toMatchObject({ expected_last_seq: 1 });
        expect(store.getState().pending).toEqual([]);
    });

    it('for a closed review stops saving and shows its state', async () => {
        const { store, client, review } = await open();
        server.backend.setState(review.id, 'submitted');
        edit(store, 'description', 'Twenty patients');
        await client.flush();
        expect(store.getState().bundle.review?.state).toBe('submitted');
        expect(store.getState().save).toBe('closed');
        edit(store, 'design.description', 'during fMRI');
        await vi.advanceTimersByTimeAsync(5000);
        await client.flush();
        expect(posts(server)).toHaveLength(1);
        expect(selectSaveLabel(store.getState())).toBe('2 unsaved');
    });
});

describe('a 422', () => {
    it('drops the ops the errors name, shows their problems, and keeps the rest', async () => {
        const { store, client } = await open();
        edit(store, 'description', 'Twenty patients');
        edit(store, 'design.description', 'during fMRI');
        const [kept, refused] = store.getState().pending;
        server.intercept(() =>
            json(
                {
                    status: 422,
                    title: 'Unprocessable Entity',
                    detail: 'op 1 leaves an invalid document',
                    errors: [
                        {
                            field: 'ops/1',
                            code: 'REJECTED',
                            message: 'extraction-record /design: too long',
                            context: { op_index: 1, client_op_id: refused.client_op_id },
                        },
                    ],
                },
                422
            )
        );
        await client.flush();
        expect(sentIds(server)).toEqual([[kept.client_op_id, refused.client_op_id], [kept.client_op_id]]);
        expect(store.getState().pending).toEqual([]);
        expect(store.getState().notices).toEqual([
            { kind: 'refused', slot: 'study design.description', message: 'extraction-record /design: too long' },
        ]);
        expect(evidenceAt(store, 'design')).toEqual({ status: 'not_found' });
        expect(evidenceAt(store, 'description')).toMatchObject({ status: 'present' });
    });

    it('takes the 422 the server raises for an op it cannot apply, and names that op', async () => {
        const { store, client, review } = await open();
        edit(store, 'description', 'Twenty patients');
        edit(store, 'design.description', 'during fMRI');
        const [kept, refused] = store.getState().pending;
        server.intercept(async (request) => {
            const batch = request.body as { expected_last_seq: number; ops: Op[] };
            const ops = batch.ops.map((op) =>
                op.client_op_id === refused.client_op_id
                    ? {
                          ...(op as SetEvidenceOp),
                          target: { kind: 'slot' as const, entity: 'study', path: 'no_such_slot' },
                      }
                    : op
            );
            try {
                return json(server.backend.postOps(review.id, { ...batch, ops }));
            } catch (error) {
                return json((error as ApiError).body, (error as ApiError).status);
            }
        });
        await client.flush();
        expect(sentIds(server)).toEqual([[kept.client_op_id, refused.client_op_id], [kept.client_op_id]]);
        expect(store.getState().pending).toEqual([]);
        expect(store.getState().notices).toEqual([
            { kind: 'refused', slot: 'study design.description', message: expect.any(String) },
        ]);
    });

    it('keeps every op pending and stops with a failed save when the 422 names no op', async () => {
        const { store, client } = await open();
        edit(store, 'description', 'Twenty patients');
        edit(store, 'design.description', 'during fMRI');
        server.intercept(() =>
            json(
                {
                    status: 422,
                    title: 'Unprocessable Entity',
                    detail: 'the batch leaves an invalid document',
                    errors: [{ field: 'ops', code: 'REJECTED', message: 'the batch is too large' }],
                },
                422
            )
        );
        await client.flush();
        expect(posts(server)).toHaveLength(1);
        expect(store.getState().pending).toHaveLength(2);
        expect(store.getState().notices).toEqual([]);
        expect(store.getState().save).toBe('failed');
        expect(selectSaveLabel(store.getState())).toBe('the batch leaves an invalid document');
    });
    it('does not resend a refused batch after a lost response, once the 422 has refused it', async () => {
        const { store, client } = await open();
        edit(store, 'description', 'Twenty patients');
        edit(store, 'design.description', 'during fMRI');
        const [kept, refused] = store.getState().pending;
        server.intercept(networkDown);
        server.intercept(() =>
            json(
                {
                    status: 422,
                    title: 'Unprocessable Entity',
                    detail: 'op 1 leaves an invalid document',
                    errors: [
                        {
                            field: 'ops/1',
                            code: 'REJECTED',
                            message: 'extraction-record /design: too long',
                            context: { op_index: 1, client_op_id: refused.client_op_id },
                        },
                    ],
                },
                422
            )
        );
        await client.flush();
        await vi.advanceTimersByTimeAsync(1000);
        await client.settled();
        expect(sentIds(server)).toEqual([
            [kept.client_op_id, refused.client_op_id],
            [kept.client_op_id, refused.client_op_id],
            [kept.client_op_id],
        ]);
        expect(store.getState().pending).toEqual([]);
        expect(store.getState().notices).toEqual([
            { kind: 'refused', slot: 'study design.description', message: 'extraction-record /design: too long' },
        ]);
    });
});

describe('a network error', () => {
    it('retries with backoff capped at 30 s, offline meanwhile', async () => {
        const { store, client } = await open();
        for (let i = 0; i < 7; i += 1) server.intercept(networkDown);
        edit(store, 'description', 'Twenty patients');
        await client.flush();
        expect(selectSaveLabel(store.getState())).toBe('offline');
        const sentAfter = async (ms: number) => {
            await vi.advanceTimersByTimeAsync(ms);
            return posts(server).length;
        };
        expect([await sentAfter(999), await sentAfter(1)]).toEqual([1, 2]);
        expect([await sentAfter(1999), await sentAfter(1)]).toEqual([2, 3]);
        await sentAfter(4000 + 8000 + 16000);
        expect(posts(server)).toHaveLength(6);
        expect([await sentAfter(29999), await sentAfter(1)]).toEqual([6, 7]);
        expect([await sentAfter(29999), await sentAfter(1)]).toEqual([7, 8]);
        await client.settled();
        expect(store.getState().pending).toEqual([]);
        expect(selectSaveLabel(store.getState())).toBe('saved');
    });

    it('retries 429 and 5xx too, and stops at a 401 to ask for a sign-in, keeping the ops pending', async () => {
        const { store, client } = await open();
        server.intercept(() => json({ status: 503, title: 'Service Unavailable', detail: 'busy' }, 503));
        server.intercept(() => json({ status: 429, title: 'Too Many Requests', detail: 'slow down' }, 429));
        edit(store, 'description', 'Twenty patients');
        await client.flush();
        await vi.advanceTimersByTimeAsync(3000);
        await client.settled();
        expect(posts(server)).toHaveLength(3);
        expect(store.getState().pending).toEqual([]);
        server.intercept(() => json({ status: 401, title: 'Unauthorized', detail: 'no token' }, 401));
        edit(store, 'design.description', 'during fMRI');
        await client.flush();
        await vi.advanceTimersByTimeAsync(60_000);
        expect(posts(server)).toHaveLength(4);
        expect(store.getState().save).toBe('signin');
        expect(selectSaveLabel(store.getState())).toBe('sign in to save');
        expect(store.getState().pending).toHaveLength(1);
    });

    it('asks to sign in when the token cannot be had, as Auth0 reports it', async () => {
        const { store } = await open();
        const api = server.api();
        const failing = createOpClient(store, {
            ...api,
            postOps: async () => {
                throw Object.assign(new Error('Login required'), { error: 'login_required' });
            },
        });
        clients.push(failing);
        edit(store, 'description', 'Twenty patients');
        await failing.flush();
        expect(store.getState().save).toBe('signin');
        expect(store.getState().pending).toHaveLength(1);
    });

    it('stops at a 403 with the role message, and at a 404 saying the review is gone', async () => {
        const { store, client } = await open();
        server.intercept(() => json({ status: 403, title: 'Forbidden', detail: 'no' }, 403));
        edit(store, 'description', 'Twenty patients');
        await client.flush();
        expect(selectSaveLabel(store.getState())).toBe('You need the admin-reviewer role');
        expect(store.getState().pending).toHaveLength(1);
        server.intercept(() => json({ status: 404, title: 'Not Found', detail: 'gone' }, 404));
        edit(store, 'design.description', 'during fMRI');
        await client.flush();
        await vi.advanceTimersByTimeAsync(60_000);
        expect(selectSaveLabel(store.getState())).toBe('the review is gone');
        expect(posts(server)).toHaveLength(2);
        expect(store.getState().pending).toHaveLength(2);
    });

    it('stop() cancels the retry it has scheduled, and its own last try does not schedule another', async () => {
        const { store, client } = await open();
        server.intercept(networkDown);
        server.intercept(networkDown);
        edit(store, 'description', 'Twenty patients');
        await client.flush();
        client.stop();
        await client.settled();
        await vi.advanceTimersByTimeAsync(60_000);
        expect(posts(server)).toHaveLength(2);
        expect(store.getState().pending).toHaveLength(1);
    });

    it('starts the backoff again from 1 s once a save has gone through', async () => {
        const { store, client } = await open();
        server.intercept(networkDown);
        server.intercept(networkDown);
        edit(store, 'description', 'Twenty patients');
        await client.flush();
        await vi.advanceTimersByTimeAsync(3000);
        expect(store.getState().pending).toEqual([]);
        server.intercept(networkDown);
        edit(store, 'design.description', 'during fMRI');
        const sent = posts(server).length;
        await vi.advanceTimersByTimeAsync(1000);
        expect(posts(server)).toHaveLength(sent + 1);
        await vi.advanceTimersByTimeAsync(999);
        expect(posts(server)).toHaveLength(sent + 1);
        await vi.advanceTimersByTimeAsync(1);
        expect(posts(server)).toHaveLength(sent + 2);
    });

    it('after a lost response resends the same client_op_ids, which the server replays', async () => {
        const { store, client } = await open();
        server.intercept(async (request) => {
            server.backend.postOps('review-1', request.body as never);
            throw new TypeError('Failed to fetch');
        });
        edit(store, 'description', 'Twenty patients');
        await client.flush();
        edit(store, 'design.description', 'during fMRI');
        await vi.advanceTimersByTimeAsync(1000);
        await client.settled();
        const [first, second, third] = sentIds(server);
        expect(second).toEqual(first);
        expect(posts(server)[1].body).toMatchObject({ expected_last_seq: 0 });
        expect(third).toHaveLength(1);
        const fresh = await server.backend.getBundle('S1');
        expect(fresh.ops.map((s) => s.op.client_op_id)).toEqual([...first, ...third]);
        expect(store.getState().ops).toEqual(fresh.ops);
        expect(store.getState().pending).toEqual([]);
    });
});

describe('a refetch and a 400', () => {
    it('retries the batch when the bundle refetch after a 409 fails', async () => {
        const { store, client, review } = await open();
        server.backend.postOps(review.id, {
            expected_last_seq: 0,
            ops: [evidenceOp('tab2-0001', 'description', 'Stroop')],
        });
        edit(store, 'design.description', 'during fMRI');
        server.intercept(() => undefined);
        server.intercept(networkDown);
        await client.flush();
        await vi.advanceTimersByTimeAsync(1000);
        await client.settled();
        expect(server.requests.map((r) => `${r.method} ${r.path}`)).toEqual([
            'POST /api/review/reviews/review-1/ops',
            'GET /api/review/sources/S1/bundle',
            'POST /api/review/reviews/review-1/ops',
            'GET /api/review/sources/S1/bundle',
            'POST /api/review/reviews/review-1/ops',
        ]);
        expect(posts(server).map((r) => (r.body as { expected_last_seq: number }).expected_last_seq)).toEqual([
            0, 0, 1,
        ]);
        expect(store.getState().pending).toEqual([]);
        expect(selectSaveLabel(store.getState())).toBe('saved');
    });

    it('stops at a 400 for a batch the spec refuses, keeping the ops pending', async () => {
        const { store, client } = await open();
        server.intercept(() =>
            json(
                { type: 'about:blank', title: 'Bad Request', detail: "[] should be non-empty - 'ops'", status: 400 },
                400
            )
        );
        edit(store, 'description', 'Twenty patients');
        await client.flush();
        await vi.advanceTimersByTimeAsync(60_000);
        expect(posts(server)).toHaveLength(1);
        expect(store.getState().pending).toHaveLength(1);
        expect(selectSaveLabel(store.getState())).toBe("[] should be non-empty - 'ops'");
    });
});
