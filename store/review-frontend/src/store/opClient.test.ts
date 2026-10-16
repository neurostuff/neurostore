import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { ReviewBundle } from '../contract/generated/review-bundle';
import { BATCH_MAX_OPS, type Op, type SetEvidenceOp } from '../contract/generated/review-ops';
import { ApiError } from '../api/reviewApi';
import { httpApi } from '../api/httpApi';
import { entityRows, ev, makeBundle, row } from '../test/bundles';
import { fakeFetch, json } from '../test/fakeFetch';
import { fakeServer, type FakeServer } from '../test/fakeServer';
import { API_BASE } from '../test/spec';
import { acceptCard, createSibling } from '../inspector/actions';
import { movePoints } from '../coordinates/actions';
import { createOpClient, type OpClient } from './opClient';
import { createReviewStores, type ReviewStores } from './context';
import { selectSaveLabel } from './sessionStore';
import { mintLocalId } from '../model/mint';
import { slotKey } from '../model/targetKey';
import { CUNEUS, FACES, HOUSES, INSULA, PRECUNEUS, coordinateBundle } from '../test/coordinates';

interface RecordedStep {
    request: { method: string; path: string; body: unknown };
    response: { status: number; body: unknown };
}
const SCENARIOS: { name: string; steps: RecordedStep[] }[] = JSON.parse(
    readFileSync(path.resolve(__dirname, '../test/golden/op-scenarios.json'), 'utf8')
);
const GOLDEN: ReviewBundle = JSON.parse(readFileSync(path.resolve(__dirname, '../test/golden/bundle.json'), 'utf8'));

const TEXT = 'Twenty patients performed a Stroop task during fMRI scanning.';
const at = (words: string): [number, number] => [TEXT.indexOf(words), TEXT.indexOf(words) + words.length];
const source = makeBundle({ description: ev('A study'), design: { description: ev('fMRI') } }, TEXT, {
    source: { ...makeBundle({}, '').source, id: 'S1', label: 'A paper' },
});

const posts = (server: FakeServer) => server.requests.filter((r) => r.method === 'POST');
const sentIds = (server: FakeServer) =>
    posts(server).map((r) => (r.body as { ops: Op[] }).ops.map((op) => op.client_op_id));
const evidenceAt = (store: ReviewStores, field: 'description' | 'design') => {
    const record = store.session.getState().record as Record<
        string,
        { evidence?: unknown; description?: { evidence: unknown } }
    >;
    return field === 'design' ? record.design.description?.evidence : record.description.evidence;
};

function edit(store: ReviewStores, path: string, words: string, mode: 'first' | 'new' = 'new') {
    store.view.getState().focusSlot(slotKey('study', path));
    expect(store.session.getState().addEvidence(store.view.getState().focus.key, at(words), mode)).toBe(true);
}

const evidenceOp = (id: string, path: string, words: string): SetEvidenceOp => ({
    client_op_id: id,
    type: 'set_evidence',
    target: { kind: 'slot', entity: 'study', path },
    evidence: { status: 'present', sets: [{ spans: [{ start_char: at(words)[0], end_char: at(words)[1] }] }] },
});

const unnamedRefusal = () =>
    json(
        {
            status: 422,
            title: 'Unprocessable Entity',
            detail: 'the batch leaves an invalid document',
            errors: [{ field: 'ops', code: 'REJECTED', message: 'the batch is too large' }],
        },
        422
    );

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
    const store = createReviewStores(await onServer.backend.getBundle('S1'));
    const client = createOpClient(store.session, onServer.api());
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
        expect(selectSaveLabel(store.session.getState())).toBe('2 unsaved');
        await vi.advanceTimersByTimeAsync(100);
        await client.settled();
        expect(sentIds(server)).toEqual([store.session.getState().ops.map((s) => s.op.client_op_id)]);
        expect(store.session.getState().pending).toEqual([]);
        expect(selectSaveLabel(store.session.getState())).toBe('saved');
        expect(posts(server)[0].body).toMatchObject({ expected_last_seq: 0 });
    });

    it('sends a card’s accepts from one Shift+A as one batch', async () => {
        const card = makeBundle(
            {
                description: ev('A study', [at('Twenty patients')]),
                design: { description: ev('fMRI', [at('Stroop task')]) },
            },
            TEXT,
            { source: { ...makeBundle({}, '').source, id: 'S1', label: 'A paper' } }
        );
        server = fakeServer([card]);
        const { store, client } = await open();
        expect(acceptCard(store)).toBe(2);
        await vi.advanceTimersByTimeAsync(1000);
        await client.settled();
        expect(sentIds(server)).toHaveLength(1);
        expect(sentIds(server)[0]).toHaveLength(2);
    });

    it('sends at most the contract’s maximum of ops a batch', async () => {
        const { store, client } = await open();
        const ops = Array.from({ length: 2 * BATCH_MAX_OPS + 200 }, (_, i) =>
            evidenceOp(`op-${String(i).padStart(6, '0')}`, 'description', i % 2 ? 'Stroop' : 'fMRI')
        );
        store.session.setState({ pending: ops });
        await vi.advanceTimersByTimeAsync(1000);
        await client.settled();
        expect(sentIds(server).map((ids) => ids.length)).toEqual([BATCH_MAX_OPS, BATCH_MAX_OPS, 200]);
        expect(posts(server).map((r) => (r.body as { expected_last_seq: number }).expected_last_seq)).toEqual([
            0,
            BATCH_MAX_OPS,
            2 * BATCH_MAX_OPS,
        ]);
        expect(store.session.getState().bundle.review?.last_seq).toBe(ops.length);
    });

    it('stays saving across batches, going idle once at the end', async () => {
        const { store, client } = await open();
        const changes: string[] = [];
        store.session.subscribe((next, previous) => {
            if (next.save !== previous.save) changes.push(next.save);
        });
        store.session.setState({
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
        expect(store.session.getState().pending).toEqual([]);
    });

    it('while hidden, sends batches under 60 KB, each emitBatch group whole', async () => {
        const { store, client } = await open();
        const id = (i: number) => `${'op-'.repeat(15)}${String(i).padStart(4, '0')}`;
        const singles = (from: number, count: number) =>
            Array.from({ length: count }, (_, i) => evidenceOp(id(from + i), 'description', i % 2 ? 'Stroop' : 'fMRI'));
        const group = [evidenceOp(id(900), 'description', 'Stroop'), evidenceOp(id(901), 'description', 'fMRI')];
        store.session.setState({ pending: singles(0, 400) });
        store.session.getState().emitBatch(group);
        store.session.setState({ pending: [...store.session.getState().pending, ...singles(400, 400)] });
        setVisibility('hidden');
        await client.settled();
        const sent = posts(server);
        expect(sent.length).toBeGreaterThan(2);
        for (const request of sent) {
            expect(request.keepalive).toBe(true);
            expect(new TextEncoder().encode(JSON.stringify(request.body)).length).toBeLessThan(60 * 1024);
        }
        const [carrying] = sent.filter((r) => (r.body as { ops: Op[] }).ops.some((op) => op.client_op_id === id(900)));
        expect((carrying.body as { ops: Op[] }).ops.map((op) => op.client_op_id)).toEqual(
            expect.arrayContaining([id(900), id(901)])
        );
        expect(sentIds(server).flat()).toHaveLength(802);
        expect(store.session.getState().pending).toEqual([]);
    });

    it('while hidden, sends a group over 60 KB alone in a request without keepalive', async () => {
        const { store, client } = await open();
        const big = Array.from({ length: 400 }, (_, i) =>
            evidenceOp(`${'op-'.repeat(15)}${String(i).padStart(4, '0')}`, 'description', i % 2 ? 'Stroop' : 'fMRI')
        );
        store.session.getState().emitBatch(big);
        setVisibility('hidden');
        await client.settled();
        expect(posts(server)).toMatchObject([{ keepalive: false }]);
        expect(sentIds(server)[0]).toHaveLength(400);
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
        expect(store.session.getState().pending).toEqual([]);
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
    expect(store.session.getState().pending).toHaveLength(1);
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
    expect(store.session.getState().pending).toHaveLength(1);
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
        expect(selectSaveLabel(store.session.getState())).toBe('saving');
        edit(store, 'design.description', 'during fMRI');
        const later = store.session.getState().pending[1];
        reply.resolve();
        await saving;
        const state = store.session.getState();
        expect(sentIds(server)).toEqual([[expect.any(String)]]);
        expect(state.pending).toEqual([later]);
        expect(state.bundle.review).toMatchObject({ last_seq: 1 });
        expect(state.bundle.review?.provenance).toHaveProperty([slotKey('study', 'description')]);
        expect(state.bundle.hidden.analyses).toEqual(['an_x']);
        expect(evidenceAt(store, 'description')).toMatchObject({ status: 'present' });
        const laterSpan = { start_char: at('during fMRI')[0], end_char: at('during fMRI')[1], text: 'during fMRI' };
        const laterEvidence = { status: 'present', sets: [{ spans: [laterSpan] }] };
        expect(later).toMatchObject({ evidence: { sets: [{ spans: [{ start_char: laterSpan.start_char }] }] } });
        expect(evidenceAt(store, 'design')).toEqual(laterEvidence);
        expect(state.index.slot(slotKey('study', 'design.description'))?.value?.evidence).toEqual(laterEvidence);
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
        expect(store.session.getState().bundle.review?.annotations).toEqual(annotations);
        expect(store.session.getState().bundle.coordinate_revision).toEqual(coordinate_revision);
    });
});

describe('a 200 reconciles the view', () => {
    it('reads only the slots its own ops and the pending ones touch, keeping the other slot nodes', async () => {
        const { store, client } = await open();
        const untouched = slotKey('study', 'design.description');
        const before = store.session.getState().index.slot(untouched);
        edit(store, 'description', 'Twenty patients');
        await client.flush();
        expect(store.session.getState().index.slot(untouched)).toBe(before);
        expect(store.session.getState().index.slot(slotKey('study', 'description'))?.value?.evidence).toMatchObject({
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
        expect(store.session.getState().pending).toEqual([]);
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
        expect(store.session.getState().pending).toEqual([]);
        expect(store.session.getState().save).toBe('idle');
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
        expect(store.session.getState().pending).toEqual([]);
        expect(store.session.getState().notices).toEqual([]);
        const fresh = await server.backend.getBundle('S1');
        expect(store.session.getState().record).toEqual(fresh.record);
        expect(store.session.getState().ops).toEqual(fresh.ops);
    });

    it('with last_seq keeps a create_entity and the set_value behind it pending, in order, the set_value unapplied', async () => {
        const { store, client, review } = await open();
        server.backend.postOps(review.id, {
            expected_last_seq: 0,
            ops: [evidenceOp('tab2-0001', 'description', 'Stroop')],
        });
        await store.session.getState().emit({
            client_op_id: 'create-1',
            type: 'create_entity',
            parent: 'study',
            list: 'groups',
            entity: { local_id: 'grp_new' },
        });
        await store.session.getState().emit({
            client_op_id: 'set-1',
            type: 'set_value',
            target: { kind: 'slot', entity: 'study', path: 'design.description' },
            value: { extraction_status: 'extracted', value: 'Changed', value_source: 'reported' },
        });
        await client.settled();
        expect(server.requests.map((r) => `${r.method} ${r.path}`)).toEqual([
            'POST /api/review/reviews/review-1/ops',
            'GET /api/review/sources/S1/bundle',
        ]);
        expect(store.session.getState().pending.map((op) => op.client_op_id)).toEqual(['create-1', 'set-1']);
        const fresh = await server.backend.getBundle('S1');
        expect(store.session.getState().record).toEqual(fresh.record);
        expect(store.session.getState().provenance).toEqual(fresh.review!.provenance);
        expect(store.session.getState().notices).toEqual([]);
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
        const [, kept] = store.session.getState().pending;
        await client.flush();
        expect(sentIds(server)[1]).toEqual([kept.client_op_id]);
        expect(store.session.getState().pending).toEqual([]);
        expect(store.session.getState().notices).toEqual([
            { kind: 'conflict', slot: 'study description', message: expect.stringContaining('set a value first') },
        ]);
        expect(store.session.getState().record).toMatchObject({ description: { extraction_status: 'not_reported' } });
    });

    it('after a partial replay sends only the new op, once the stored one is in the fresh bundle', async () => {
        const { store, client, review } = await open();
        edit(store, 'description', 'Twenty patients');
        const [stored] = store.session.getState().pending;
        server.backend.postOps(review.id, { expected_last_seq: 0, ops: [stored] });
        edit(store, 'design.description', 'during fMRI');
        const [, fresh] = store.session.getState().pending;
        await client.flush();
        expect(server.requests.map((r) => `${r.method} ${r.path}`)).toEqual([
            'POST /api/review/reviews/review-1/ops',
            'GET /api/review/sources/S1/bundle',
            'POST /api/review/reviews/review-1/ops',
        ]);
        expect(sentIds(server)).toEqual([[stored.client_op_id, fresh.client_op_id], [fresh.client_op_id]]);
        expect(posts(server)[1].body).toMatchObject({ expected_last_seq: 1 });
        expect(store.session.getState().pending).toEqual([]);
    });

    it('for a closed review stops saving and shows its state', async () => {
        const { store, client, review } = await open();
        server.backend.setState(review.id, 'submitted');
        edit(store, 'description', 'Twenty patients');
        await client.flush();
        expect(store.session.getState().bundle.review?.state).toBe('submitted');
        expect(store.session.getState().save).toBe('closed');
        edit(store, 'design.description', 'during fMRI');
        await vi.advanceTimersByTimeAsync(5000);
        await client.flush();
        expect(posts(server)).toHaveLength(1);
        expect(selectSaveLabel(store.session.getState())).toBe('2 unsaved');
    });
});

describe('a 422', () => {
    it('drops the ops the errors name, shows their problems, and keeps the rest', async () => {
        const { store, client } = await open();
        edit(store, 'description', 'Twenty patients');
        edit(store, 'design.description', 'during fMRI');
        const [kept, refused] = store.session.getState().pending;
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
        expect(store.session.getState().pending).toEqual([]);
        expect(store.session.getState().notices).toEqual([
            { kind: 'refused', slot: 'study design.description', message: 'extraction-record /design: too long' },
        ]);
        expect(evidenceAt(store, 'design')).toEqual({ status: 'not_found' });
        expect(evidenceAt(store, 'description')).toMatchObject({ status: 'present' });
    });

    it('takes the 422 the server raises for an op it cannot apply, and names that op', async () => {
        const { store, client, review } = await open();
        edit(store, 'description', 'Twenty patients');
        edit(store, 'design.description', 'during fMRI');
        const [kept, refused] = store.session.getState().pending;
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
        expect(store.session.getState().pending).toEqual([]);
        expect(store.session.getState().notices).toEqual([
            { kind: 'refused', slot: 'study design.description', message: expect.any(String) },
        ]);
    });

    it('blocks saving, keeping every op pending, when the 422 names no op', async () => {
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
        expect(store.session.getState().pending).toHaveLength(2);
        expect(store.session.getState().notices).toEqual([]);
        expect(store.session.getState().save).toBe('failed');
        expect(store.session.getState().blocked).toEqual({
            clientOpIds: store.session.getState().pending.map((op) => op.client_op_id),
            problems: ['the batch is too large'],
        });
        expect(selectSaveLabel(store.session.getState())).toBe('the batch leaves an invalid document');
        edit(store, 'description', 'Stroop task');
        await vi.advanceTimersByTimeAsync(5000);
        expect(posts(server)).toHaveLength(1);
    });

    it('undoes the refused batch, rebuilding from the confirmed record, then resumes saving the rest', async () => {
        const { store, client } = await open();
        edit(store, 'description', 'Twenty patients');
        server.intercept(() =>
            json(
                {
                    status: 422,
                    title: 'Unprocessable Entity',
                    detail: 'the batch leaves an invalid document',
                    errors: [{ field: 'ops', code: 'REJECTED', message: 'extraction-record /description: too long' }],
                },
                422
            )
        );
        await client.flush();
        edit(store, 'design.description', 'during fMRI');
        expect(evidenceAt(store, 'description')).toMatchObject({ status: 'present' });
        await client.undoBlocked();
        expect(store.session.getState().save).toBe('idle');
        expect(store.session.getState().blocked).toBeNull();
        expect(evidenceAt(store, 'description')).toEqual({ status: 'not_found' });
        expect(sentIds(server).at(-1)).toHaveLength(1);
        expect(store.session.getState().pending).toEqual([]);
        expect(store.session.getState().bundle.review?.last_seq).toBe(1);
    });
    it('does not resend a refused batch after a lost response, once the 422 has refused it', async () => {
        const { store, client } = await open();
        edit(store, 'description', 'Twenty patients');
        edit(store, 'design.description', 'during fMRI');
        const [kept, refused] = store.session.getState().pending;
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
        expect(store.session.getState().pending).toEqual([]);
        expect(store.session.getState().notices).toEqual([
            { kind: 'refused', slot: 'study design.description', message: 'extraction-record /design: too long' },
        ]);
    });

    it('keeps an edit made after the block when undoing, and drops it when discarding', async () => {
        const { store, client } = await open();
        edit(store, 'description', 'Twenty patients');
        server.intercept(() => unnamedRefusal());
        await client.flush();
        edit(store, 'design.description', 'during fMRI');
        const later = store.session.getState().pending.at(-1)!;
        await client.undoBlocked();
        expect(sentIds(server).at(-1)).toEqual([later.client_op_id]);
        expect(store.session.getState().pending).toEqual([]);
        expect(evidenceAt(store, 'design')).toMatchObject({ status: 'present' });

        server.intercept(() => unnamedRefusal());
        edit(store, 'description', 'Stroop task');
        await client.flush();
        edit(store, 'design.description', 'during fMRI');
        client.discardPending();
        expect(store.session.getState().pending).toEqual([]);
        expect(store.session.getState().blocked).toBeNull();
        await vi.advanceTimersByTimeAsync(5000);
        expect(posts(server)).toHaveLength(3);
    });

    it('rolls the record back to the confirmed one at once when the refused edit is undone', async () => {
        const { store, client } = await open();
        edit(store, 'description', 'Twenty patients');
        server.intercept(() => unnamedRefusal());
        await client.flush();
        await client.undoBlocked();
        expect(posts(server)).toHaveLength(1);
        expect(evidenceAt(store, 'description')).toEqual({ status: 'not_found' });
    });

    it('rolls the record back and clears the block when the pending edits are discarded', async () => {
        const { store, client } = await open();
        edit(store, 'description', 'Twenty patients');
        edit(store, 'design.description', 'during fMRI');
        server.intercept(() => unnamedRefusal());
        await client.flush();
        client.discardPending();
        expect(evidenceAt(store, 'description')).toEqual({ status: 'not_found' });
        expect(evidenceAt(store, 'design')).toEqual({ status: 'not_found' });
        expect(store.session.getState().blocked).toBeNull();
        expect(store.session.getState().save).toBe('idle');
        expect(selectSaveLabel(store.session.getState())).toBe('saved');
    });

    it('does not change the review state while blocked', async () => {
        const { store, client } = await open();
        edit(store, 'description', 'Twenty patients');
        server.intercept(() => unnamedRefusal());
        await client.flush();
        await client.changeState('submitted');
        expect(server.requests.filter((r) => r.method === 'PATCH')).toEqual([]);
        expect(store.session.getState().bundle.review?.state).toBe('in_progress');
    });

    it('forgets the group of ops once they are saved', async () => {
        const { store, client } = await open();
        store.session.getState().emitBatch([
                evidenceOp('group-a-op', 'description', 'Twenty'),
                evidenceOp('group-b-op', 'description', 'Stroop'),
            ]);
        await client.flush();
        expect(store.session.getState().pending).toEqual([]);
        expect(store.session.getState().groupOf).toEqual({});
    });

    it('forgets the group of ops once they are discarded', async () => {
        const { store, client } = await open();
        store.session.getState().emitBatch([
                evidenceOp('group-a-op', 'description', 'Twenty'),
                evidenceOp('group-b-op', 'description', 'Stroop'),
            ]);
        client.discardPending();
        expect(store.session.getState().pending).toEqual([]);
        expect(store.session.getState().groupOf).toEqual({});
    });

    it('while hidden, cuts before a two-op group that would straddle 60 KB, and sends the group whole', async () => {
        const { store, client } = await open();
        const bulky = (op: Op): Op => ({ ...op, note: 'x'.repeat(9000) });
        const singles = Array.from({ length: 5 }, (_, i) => bulky(evidenceOp(`op-single-${i}`, 'description', 'fMRI')));
        const group = [
            bulky(evidenceOp('op-first', 'description', 'Stroop')),
            bulky(evidenceOp('op-second', 'description', 'Twenty')),
        ];
        store.session.setState({ pending: singles });
        store.session.getState().emitBatch(group);
        setVisibility('hidden');
        await client.settled();
        expect(sentIds(server)).toEqual([singles.map((op) => op.client_op_id), group.map((op) => op.client_op_id)]);
        expect(posts(server).map((r) => r.keepalive)).toEqual([true, true]);
    });

    it('while hidden, keeps the ops of a coordinate move together in one keepalive batch', async () => {
        server = fakeServer([coordinateBundle({ source: source.source })]);
        const { store, client } = await open();
        store.view.getState().focusAnalysis(FACES.key, 0);
        expect(movePoints(store, HOUSES.key)).toBe(true);
        setVisibility('hidden');
        await client.settled();
        expect(posts(server)[0]).toMatchObject({ keepalive: true });
        expect(sentIds(server)[0]).toHaveLength(2);
    });
});

describe('a network error', () => {
    it('retries with backoff capped at 30 s, offline meanwhile', async () => {
        const { store, client } = await open();
        for (let i = 0; i < 7; i += 1) server.intercept(networkDown);
        edit(store, 'description', 'Twenty patients');
        await client.flush();
        expect(selectSaveLabel(store.session.getState())).toBe('offline');
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
        expect(store.session.getState().pending).toEqual([]);
        expect(selectSaveLabel(store.session.getState())).toBe('saved');
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
        expect(store.session.getState().pending).toEqual([]);
        server.intercept(() => json({ status: 401, title: 'Unauthorized', detail: 'no token' }, 401));
        edit(store, 'design.description', 'during fMRI');
        await client.flush();
        await vi.advanceTimersByTimeAsync(60_000);
        expect(posts(server)).toHaveLength(4);
        expect(store.session.getState().save).toBe('signin');
        expect(selectSaveLabel(store.session.getState())).toBe('sign in to save');
        expect(store.session.getState().pending).toHaveLength(1);
    });

    it('asks to sign in when the token cannot be had, as Auth0 reports it', async () => {
        const { store } = await open();
        const api = server.api();
        const failing = createOpClient(store.session, {
            ...api,
            postOps: async () => {
                throw Object.assign(new Error('Login required'), { error: 'login_required' });
            },
        });
        clients.push(failing);
        edit(store, 'description', 'Twenty patients');
        await failing.flush();
        expect(store.session.getState().save).toBe('signin');
        expect(store.session.getState().pending).toHaveLength(1);
    });

    it.each(['login_required', 'consent_required', 'missing_refresh_token', 'interaction_required'])(
        'asks to sign in again for %s, keeping the ops pending',
        async (code) => {
            const { store } = await open();
            const api = server.api();
            const failing = createOpClient(store.session, {
                ...api,
                postOps: async () => {
                    throw Object.assign(new Error('Sign in again'), { error: code });
                },
            });
            clients.push(failing);
            edit(store, 'description', 'Twenty patients');
            await failing.flush();
            expect(store.session.getState().save).toBe('signin');
            expect(store.session.getState().pending).toHaveLength(1);
        }
    );

    it('stops at a 403 with the role message, and at a 404 saying the review is gone', async () => {
        const { store, client } = await open();
        server.intercept(() => json({ status: 403, title: 'Forbidden', detail: 'no' }, 403));
        edit(store, 'description', 'Twenty patients');
        await client.flush();
        expect(selectSaveLabel(store.session.getState())).toBe('You need the admin-reviewer role');
        expect(store.session.getState().pending).toHaveLength(1);
        server.intercept(() => json({ status: 404, title: 'Not Found', detail: 'gone' }, 404));
        edit(store, 'design.description', 'during fMRI');
        await client.flush();
        await vi.advanceTimersByTimeAsync(60_000);
        expect(selectSaveLabel(store.session.getState())).toBe('the review is gone');
        expect(posts(server)).toHaveLength(2);
        expect(store.session.getState().pending).toHaveLength(2);
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
        expect(store.session.getState().pending).toHaveLength(1);
    });

    it('starts the backoff again from 1 s once a save has gone through', async () => {
        const { store, client } = await open();
        server.intercept(networkDown);
        server.intercept(networkDown);
        edit(store, 'description', 'Twenty patients');
        await client.flush();
        await vi.advanceTimersByTimeAsync(3000);
        expect(store.session.getState().pending).toEqual([]);
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
        expect(store.session.getState().ops).toEqual(fresh.ops);
        expect(store.session.getState().pending).toEqual([]);
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
        expect(store.session.getState().pending).toEqual([]);
        expect(selectSaveLabel(store.session.getState())).toBe('saved');
    });

    it('stops at a 400 for a batch the spec refuses, keeping the ops pending', async () => {
        const { store, client } = await open();
        server.intercept(() =>
            json(
                {
                    type: 'about:blank',
                    title: 'Bad Request',
                    detail: 'The request body is not valid.',
                    status: 400,
                    errors: [{ field: 'ops.0', code: 'type', message: 'failed the type rule' }],
                },
                400
            )
        );
        edit(store, 'description', 'Twenty patients');
        await client.flush();
        await vi.advanceTimersByTimeAsync(60_000);
        expect(posts(server)).toHaveLength(1);
        expect(store.session.getState().pending).toHaveLength(1);
        expect(selectSaveLabel(store.session.getState())).toBe('ops.0: failed the type rule');
    });

    it('falls back to the detail of a 400 that carries no errors', async () => {
        const { store, client } = await open();
        server.intercept(() =>
            json({ type: 'about:blank', title: 'Bad Request', detail: 'Request body must not be empty', status: 400 }, 400)
        );
        edit(store, 'description', 'Twenty patients');
        await client.flush();
        await vi.advanceTimersByTimeAsync(60_000);
        expect(selectSaveLabel(store.session.getState())).toBe('Request body must not be empty');
    });
});

describe('an op the server applies', () => {
    it('goes out at once and stays pending, unapplied, until its result brings the record and entity index', async () => {
        const { store, client } = await open();
        const reply = deferred<void>();
        const id = 'grp_new';
        server.intercept(async (request) => {
            await reply.promise;
            const [created] = (request.body as { ops: Op[] }).ops;
            const bundle = await server.backend.getBundle('S1');
            const at = '2026-10-15T00:00:00Z';
            return json({
                ops: [{ seq: 1, op: created, before: null, after: {}, user_id: 'me', created_at: at }],
                last_seq: 1,
                record: { ...bundle.record, groups: [{ local_id: id }] },
                coordinate_revision: null,
                provenance: { [`entity:${id}`]: { state: 'added', user_id: 'me', at } },
                annotations: {},
                hidden: bundle.hidden,
                entities: [
                    ...bundle.entities,
                    {
                        local_id: id,
                        entity_class: 'Group',
                        schema_class: 'Group',
                        parent: 'study',
                        list_path: 'groups',
                    },
                ],
            });
        });
        const before = store.session.getState().record;
        await store.session.getState().emit({
            client_op_id: 'create-1',
            type: 'create_entity',
            parent: 'study',
            list: 'groups',
            entity: { local_id: id },
        });
        await vi.advanceTimersByTimeAsync(0);
        expect(sentIds(server)).toEqual([['create-1']]);
        expect(store.session.getState().pending.map((op) => op.client_op_id)).toEqual(['create-1']);
        expect(store.session.getState().record).toBe(before);
        expect(store.session.getState().index.entity(id)).toBeUndefined();
        reply.resolve();
        await client.settled();
        expect(store.session.getState().pending).toEqual([]);
        expect(store.session.getState().record).toMatchObject({ groups: [{ local_id: id }] });
        expect(store.session.getState().provenance).toHaveProperty([`entity:${id}`]);
        expect(store.session.getState().index.entity(id)).toMatchObject({ entityClass: 'Group' });
    });

    it('flushes at once when a create_entity is emitted while a local op is still debouncing', async () => {
        const { store } = await open();
        edit(store, 'description', 'Twenty patients');
        expect(posts(server)).toHaveLength(0);
        await store.session.getState().emit({
            client_op_id: 'create-1',
            type: 'create_entity',
            parent: 'study',
            list: 'groups',
            entity: { local_id: 'grp_new' },
        });
        await vi.advanceTimersByTimeAsync(0);
        expect((posts(server)[0].body as { ops: Op[] }).ops.map((op) => op.type)).toEqual([
            'set_evidence',
            'create_entity',
        ]);
    });
});

describe('a browser outside a secure context, with getRandomValues only', () => {
    it('sends v4 UUIDs, and a create_entity with the local_id the core mints', async () => {
        const native = globalThis.crypto;
        vi.stubGlobal('crypto', { getRandomValues: native.getRandomValues.bind(native) });
        const groups = makeBundle({ groups: [{ local_id: 'grp_a', name: ev('Patients') }] }, TEXT, {
            source: { ...makeBundle({}, '').source, id: 'S1', label: 'A paper' },
            entities: entityRows(row('grp_a', 'Group', 'groups')),
        });
        server = fakeServer([groups]);
        const { store, client } = await open();
        store.view.getState().focusSlot(slotKey('grp_a', 'name'));
        expect(store.session.getState().addEvidence(store.view.getState().focus.key, at('Twenty'), 'new')).toBe(true);
        store.view.getState().focusEntity('grp_a');
        expect(createSibling(store, 'Group')).toBe(true);
        const created = store.session.getState().pending.find((op) => op.type === 'create_entity')!;
        await store.session.getState().minted(created.client_op_id);
        await vi.advanceTimersByTimeAsync(1000);
        await client.settled();
        const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
        expect(sentIds(server).flat()).toContain(created.client_op_id);
        for (const id of sentIds(server).flat()) expect(id).toMatch(V4);
        const sent = (posts(server)[0].body as { ops: Op[] }).ops.find((op) => op.type === 'create_entity')!;
        const minted = `rv_${createHash('sha256').update(created.client_op_id).digest('hex').slice(0, 12)}`;
        expect((sent.entity as { local_id: string }).local_id).toBe(minted);
    });
});

describe('an op the server applies, as the recorded server answered it', () => {
    const [created, edited] = SCENARIOS.find(
        (scenario) => scenario.name === 'create an entity with a client local id, then set a value on it'
    )!.steps.filter((step) => step.request.method === 'POST');
    const CREATED_ID = 'rv_1530318ddf94';
    const SERVER_MINTED_ID = 'rv_20feae62f38c';

    it('takes its local_id from the client_op_id as the core does, and the server mints the same as recorded', async () => {
        expect(await mintLocalId('scenario-create-entity-a', new Set())).toBe(CREATED_ID);
        const minting = SCENARIOS.find((scenario) => scenario.name === 'create an entity the server mints an id for')!;
        const [answered] = minting.steps.filter((step) => step.request.method === 'POST');
        const [{ after }] = (answered.response.body as { ops: { after: { entity: { local_id: string } } }[] }).ops;
        expect(after.entity.local_id).toBe(SERVER_MINTED_ID);
        expect(await mintLocalId('scenario-create-entity-b', new Set())).toBe(SERVER_MINTED_ID);
    });

    it('sends the create alone, holds the set_value on its new id until the answer, then sends it as recorded', async () => {
        const release = deferred<void>();
        let posted = 0;
        const replay = fakeFetch(async () => {
            const reply = [created, edited][posted++].response;
            if (posted === 1) await release.promise;
            return json(reply.body, reply.status);
        });
        const store = createReviewStores({ ...GOLDEN, review: { ...GOLDEN.review!, last_seq: 0 } });
        const client = createOpClient(
            store.session,
            httpApi(API_BASE, async () => 'token-1', replay.fetch)
        );
        client.start();
        clients.push(client);
        const createOp: Op = {
            client_op_id: 'scenario-create-entity-a',
            type: 'create_entity',
            parent: 'study',
            list: 'groups',
            entity: {
                name: { extraction_status: 'not_reported', evidence: { status: 'not_applicable' } },
                species: { extraction_status: 'not_reported', evidence: { status: 'not_applicable' } },
            },
        } as Op;
        const [setOp] = (edited.request.body as { ops: Op[] }).ops;

        await store.session.getState().emit(createOp);
        await store.session.getState().minted('scenario-create-entity-a');
        await vi.advanceTimersByTimeAsync(0);
        expect(replay.requests.map((r) => r.body)).toEqual([created.request.body]);
        const held = store.session.getState().record;
        await store.session.getState().emit(setOp);
        expect(store.session.getState().pending.map((op) => op.client_op_id)).toEqual([
            'scenario-create-entity-a',
            'scenario-set-created-a',
        ]);
        expect(store.session.getState().record).toBe(held);
        expect(store.session.getState().provenance).toEqual(GOLDEN.review!.provenance);

        release.resolve();
        await vi.advanceTimersByTimeAsync(1000);
        await client.settled();
        expect(replay.requests.map((r) => r.body)).toEqual([created.request.body, edited.request.body]);
        expect(store.session.getState().pending).toEqual([]);
        expect(store.session.getState().index.entity(CREATED_ID)).toMatchObject({ entityClass: 'Group' });
    });
});

describe('offsets outside the Basic Multilingual Plane', () => {
    const WIDE = 'Den 𝛼 cohort: 😀 twenty patients.';

    it('sends each span in code points, as the contract counts them', async () => {
        server = fakeServer([makeBundle({ description: ev('A study') }, WIDE, { source: source.source })]);
        const { store, client } = await open();
        const start = WIDE.indexOf('twenty');
        store.view.getState().focusSlot(slotKey('study', 'description'));
        expect(
            store.session.getState().addEvidence(store.view.getState().focus.key, [start, start + 6], 'new')
        ).toBe(true);
        await vi.advanceTimersByTimeAsync(1000);
        await client.settled();
        const [op] = (posts(server)[0].body as { ops: SetEvidenceOp[] }).ops;
        expect(op.evidence).toMatchObject({ sets: [{ spans: [{ start_char: 16, end_char: 22 }] }] });
    });
});

describe('a batch of coordinate ops', () => {
    it('goes out in one POST, both ops in it, when the debounce is flushed at once', async () => {
        server = fakeServer([coordinateBundle({ source: source.source })]);
        const { store, client } = await open();
        const edit = (id: string, analysis_key: string, points: unknown[]) =>
            ({
                client_op_id: id,
                type: 'coordinate',
                target: { kind: 'coordinate_analysis', analysis_key },
                action: 'edit_points',
                payload: { points },
            }) as Op;
        expect(
            store.session.getState().emitBatch([edit('move-0001', FACES.key, [CUNEUS]), edit('move-0002', HOUSES.key, [INSULA, PRECUNEUS])])
        ).toBe(true);
        await client.flush();
        expect(sentIds(server)[0]).toEqual(['move-0001', 'move-0002']);
    });
});
