import type { ReviewBundle } from '../contract/generated/review-bundle';
import type { Op, RelationshipTarget } from '../contract/generated/review-ops';
import { entityRows, ev, makeBundle, row } from '../test/bundles';
import { fakeServer, type FakeServer } from '../test/fakeServer';
import { answerPending, withoutIds } from '../test/undoHelpers';
import { slotKey } from '../model/targetKey';
import { createOpClient, type OpClient } from './opClient';
import { createReviewStores, type ReviewStores } from './context';
import { selectCanRedo, selectCanUndo } from './sessionStore';
import type { InverseOp } from './undoSteps';

const TEXT = 'Twenty patients performed a Stroop task during fMRI scanning.';
const record = {
    description: ev('A study'),
    groups: [
        { local_id: 'grp_a', name: ev('Patients') },
        { local_id: 'grp_b', name: ev('Controls') },
    ],
    regions: [{ local_id: 'reg_1' }],
    analyses: [{ local_id: 'an_1' }],
};
const entities = entityRows(
    row('grp_a', 'Group', 'groups'),
    row('grp_b', 'Group', 'groups'),
    row('reg_1', 'Region', 'regions'),
    row('an_1', 'Analysis', 'analyses')
);
const review: NonNullable<ReviewBundle['review']> = {
    id: 'r1',
    user_id: 'u1',
    state: 'in_progress',
    last_seq: 0,
    provenance: {},
    annotations: {},
};
const open = () => createReviewStores(makeBundle(record, TEXT, { entities, review }), { now: () => 'now' });

const regions: RelationshipTarget = { kind: 'relationship', entity: 'an_1', path: 'regions', target_entity: 'reg_1' };
const LINK: Op = { client_op_id: 'link-0001', type: 'link', target: regions };
const UNLINK: InverseOp = { type: 'unlink', target: regions };
const RELINK: InverseOp = { type: 'link', target: regions };
const CREATE: Op = {
    client_op_id: 'create-0001',
    type: 'create_entity',
    parent: 'study',
    list: 'groups',
    entity: { local_id: 'grp_c', name: ev('Siblings') },
};
const DELETE_C: InverseOp = { type: 'delete_entity', target: { kind: 'entity', entity: 'grp_c' } };
const RECREATE_C: InverseOp = {
    type: 'create_entity',
    parent: 'study',
    list: 'groups',
    index: 2,
    entity: { local_id: 'grp_c', name: ev('Siblings') },
};
const DELETE: Op = { client_op_id: 'delete-0001', type: 'delete_entity', target: { kind: 'entity', entity: 'grp_a' } };
const RECREATE_A: InverseOp = {
    type: 'create_entity',
    parent: 'study',
    list: 'groups',
    index: 0,
    entity: record.groups[0],
};
const DELETE_A: InverseOp = { type: 'delete_entity', target: { kind: 'entity', entity: 'grp_a' } };

const restore = (name: string): InverseOp => ({
    type: 'coordinate',
    target: { kind: 'coordinate_parse' },
    action: 'restore',
    payload: { remove: [], insert: [], reasons: { [name]: 'kept' }, record: { remove: [], insert: [] } },
});
const editPoints = (id: string, key: string): Op => ({
    client_op_id: id,
    type: 'coordinate',
    target: { kind: 'coordinate_analysis', analysis_key: key },
    action: 'edit_points',
    payload: { points: [] },
});

const GRP_A = { kind: 'entity', entity: 'grp_a' } as const;
const ACCEPT_GRP_A: Op = { client_op_id: 'accept-0001', type: 'verdict', target: GRP_A, verdict: 'accept' };
const REJECT_GRP_A: Op = {
    client_op_id: 'reject-0001',
    type: 'verdict',
    target: GRP_A,
    verdict: 'reject',
    reason: 'duplicate',
};
const CLEAR_GRP_A: InverseOp = { type: 'verdict', target: GRP_A, verdict: 'clear' };

const pendingIds = (store: ReviewStores) => store.session.getState().pending.map((op) => op.client_op_id);
const groupsOfPending = (store: ReviewStores) => {
    const { pending, groupOf } = store.session.getState();
    return new Set(pending.map((op) => groupOf[op.client_op_id] ?? op.client_op_id));
};

describe('undo and redo of server-applied ops', () => {
    it.each([
        ['a link', LINK, UNLINK, RELINK],
        ['a create', CREATE, DELETE_C, RECREATE_C],
        ['a delete', DELETE, RECREATE_A, DELETE_A],
    ])(
        'undoes %s by sending its inverse, and redoes it by sending the inverse’s inverse',
        (_, edit, inverse, again) => {
            const store = open();
            store.session.getState().emit(edit);
            answerPending(store, () => [inverse]);
            store.session.getState().undo();
            expect(withoutIds(store.session.getState().pending)).toEqual([inverse]);
            expect(pendingIds(store)).not.toContain(edit.client_op_id);
            answerPending(store, () => [again]);
            store.session.getState().redo();
            expect(withoutIds(store.session.getState().pending)).toEqual([again]);
            const [redone] = pendingIds(store);
            answerPending(store, () => [inverse]);
            store.session.getState().undo();
            expect(withoutIds(store.session.getState().pending)).toEqual([inverse]);
            expect(pendingIds(store)).not.toContain(redone);
        }
    );

    it('undoes a coordinate move as one batch of the restores, last op first, and redoes it as one batch', () => {
        const store = open();
        const moved = [editPoints('move-0001', 'analysis#a'), editPoints('move-0002', 'analysis#b')];
        store.session.getState().emitBatch(moved);
        answerPending(store, (op) => [restore(`undoes ${op.client_op_id}`)]);
        store.session.getState().undo();
        expect(withoutIds(store.session.getState().pending)).toEqual([
            restore('undoes move-0002'),
            restore('undoes move-0001'),
        ]);
        expect(groupsOfPending(store).size).toBe(1);
        const [second, first] = store.session.getState().pending;
        answerPending(store, (op) => [restore(`redoes ${op.client_op_id}`)]);
        store.session.getState().redo();
        expect(withoutIds(store.session.getState().pending)).toEqual([
            restore(`redoes ${first.client_op_id}`),
            restore(`redoes ${second.client_op_id}`),
        ]);
        expect(groupsOfPending(store).size).toBe(1);
    });
});

describe('the undo stack', () => {
    it('waits while the edit is unconfirmed, then undoes it once the server answers', () => {
        const store = open();
        store.session.getState().emit(LINK);
        store.session.getState().undo();
        expect(pendingIds(store)).toEqual(['link-0001']);
        answerPending(store, () => [UNLINK]);
        expect(withoutIds(store.session.getState().pending)).toEqual([UNLINK]);
    });

    it('drops the redo stack on a new edit', () => {
        const store = open();
        store.session.getState().emit(LINK);
        answerPending(store, () => [UNLINK]);
        store.session.getState().undo();
        answerPending(store, () => [RELINK]);
        expect(selectCanRedo(store.session.getState())).toBe(true);
        store.session.getState().emit(CREATE);
        expect(selectCanRedo(store.session.getState())).toBe(false);
        store.session.getState().redo();
        expect(pendingIds(store)).toEqual(['create-0001']);
    });

    it('keeps the stack as it was after a refused undo, and shows the server’s reason', () => {
        const store = open();
        store.session.getState().emit(LINK);
        answerPending(store, () => [UNLINK]);
        store.session.getState().undo();
        expect(store.session.getState().pending).toHaveLength(1);
        const [undo] = store.session.getState().pending;
        const message = "entity 'an_1' has changed since";
        store.session.getState().refuse([{ op: undo, message }]);
        expect(store.session.getState().pending).toEqual([]);
        expect(store.session.getState().notices).toEqual([expect.objectContaining({ kind: 'undo', message })]);
        store.session.getState().redo();
        expect(store.session.getState().pending).toEqual([]);
        store.session.getState().undo();
        expect(withoutIds(store.session.getState().pending)).toEqual([UNLINK]);
        expect(pendingIds(store)).not.toContain(undo.client_op_id);
    });

    it('drops every op of a refused undo, not only the one the server named', () => {
        const store = open();
        store.session
            .getState()
            .emitBatch([editPoints('move-0001', 'analysis#a'), editPoints('move-0002', 'analysis#b')]);
        answerPending(store, (op) => [restore(`undoes ${op.client_op_id}`)]);
        store.session.getState().undo();
        expect(store.session.getState().pending).toHaveLength(2);
        const [named] = store.session.getState().pending;
        store.session.getState().refuse([{ op: named, message: 'has changed since' }]);
        expect(store.session.getState().pending).toEqual([]);
    });

    it('does nothing while saving is blocked', () => {
        const store = open();
        store.session.getState().emit(LINK);
        answerPending(store, () => [UNLINK]);
        store.session.getState().emit(CREATE);
        expect(selectCanUndo(store.session.getState())).toBe(true);
        store.session.getState().block([CREATE], 'the batch leaves an invalid document', ['problem']);
        expect(selectCanUndo(store.session.getState())).toBe(false);
        store.session.getState().undo();
        expect(pendingIds(store)).toEqual(['create-0001']);
    });

    it('undoes an accept: the reviewer’s judgement goes', () => {
        const store = open();
        store.session.getState().emit(ACCEPT_GRP_A);
        answerPending(store, () => [CLEAR_GRP_A]);
        expect(store.session.getState().provenance).toHaveProperty(['entity:grp_a']);
        store.session.getState().undo();
        expect(withoutIds(store.session.getState().pending)).toEqual([CLEAR_GRP_A]);
        expect(store.session.getState().provenance).not.toHaveProperty(['entity:grp_a']);
    });

    it('undoes a reject: the judgement it replaced comes back', () => {
        const store = open();
        store.session.getState().emit(ACCEPT_GRP_A);
        answerPending(store, () => [CLEAR_GRP_A]);
        const verified = store.session.getState().provenance['entity:grp_a'];
        store.session.getState().emit(REJECT_GRP_A);
        answerPending(store, () => [{ type: 'verdict', target: GRP_A, verdict: 'restore', previous: verified }]);
        store.session.getState().undo();
        expect(withoutIds(store.session.getState().pending)).toEqual([
            { type: 'verdict', target: GRP_A, verdict: 'restore', previous: verified },
        ]);
        expect(store.session.getState().provenance['entity:grp_a']).toEqual(verified);
    });

    it('an undo after a verdict undoes the verdict, and the edit before it stays', () => {
        const store = open();
        store.session.getState().emit(LINK);
        answerPending(store, () => [UNLINK]);
        store.session.getState().emit(ACCEPT_GRP_A);
        answerPending(store, () => [CLEAR_GRP_A]);
        store.session.getState().undo();
        expect(withoutIds(store.session.getState().pending)).toEqual([CLEAR_GRP_A]);
    });
});

describe('the undo stack, step by step', () => {
    it('keeps one step per intent: the first undo reverts the create alone, the second the link', () => {
        const store = open();
        store.session.getState().emit(LINK);
        answerPending(store, () => [UNLINK]);
        store.session.getState().emit(CREATE);
        answerPending(store, () => [DELETE_C]);
        store.session.getState().undo();
        expect(withoutIds(store.session.getState().pending)).toEqual([DELETE_C]);
        answerPending(store, () => [RECREATE_C]);
        store.session.getState().undo();
        expect(withoutIds(store.session.getState().pending)).toEqual([UNLINK]);
    });

    it('sends nothing for undo or redo while saving is blocked', () => {
        const store = open();
        store.session.getState().emit(LINK);
        answerPending(store, () => [UNLINK]);
        store.session.getState().emit(CREATE);
        answerPending(store, () => [DELETE_C]);
        store.session.getState().undo();
        answerPending(store, () => [RECREATE_C]);
        store.session.getState().block([], 'refused', ['a later batch']);
        store.session.getState().undo();
        expect(pendingIds(store)).toEqual([]);
        store.session.getState().redo();
        expect(pendingIds(store)).toEqual([]);
    });

    it('a redo pressed while its step is unconfirmed waits, then sends once the server answers', () => {
        const store = open();
        store.session.getState().emit(LINK);
        answerPending(store, () => [UNLINK]);
        store.session.getState().undo();
        store.session.getState().redo();
        expect(withoutIds(store.session.getState().pending)).toEqual([UNLINK]);
        answerPending(store, () => [RELINK]);
        expect(withoutIds(store.session.getState().pending)).toEqual([RELINK]);
    });

    it('a new edit cancels a pending undo, so neither edit is undone by itself later', () => {
        const store = open();
        store.session.getState().emit(LINK);
        store.session.getState().undo();
        store.session.getState().emit(CREATE);
        answerPending(store, (op) => (op.type === 'link' ? [UNLINK] : [DELETE_C]));
        expect(pendingIds(store)).toEqual([]);
        store.session.getState().undo();
        expect(withoutIds(store.session.getState().pending)).toEqual([DELETE_C]);
    });

    it('a refused redo shows its reason, puts the step back on the redo stack and drops the whole batch', () => {
        const store = open();
        store.session.getState().emit(LINK);
        answerPending(store, () => [UNLINK]);
        store.session.getState().undo();
        answerPending(store, () => [RELINK]);
        store.session.getState().redo();
        const [sent] = store.session.getState().pending;
        store.session.getState().refuse([{ op: sent, message: 'nope' }]);
        expect(store.session.getState().notices).toEqual([expect.objectContaining({ kind: 'redo', message: 'nope' })]);
        expect(store.session.getState().pending).toEqual([]);
        expect(store.session.getState().redoStack).toHaveLength(1);
    });

    it('undoes a batch that mixes a verdict with a set_value as one step, last op first', () => {
        const edit: Op = {
            client_op_id: 'edit-0001',
            type: 'set_value',
            target: { kind: 'slot', entity: 'study', path: 'description' },
            value: { extraction_status: 'extracted', value: 'B study', value_source: 'reported' },
        };
        const undoEdit: InverseOp = {
            type: 'set_value',
            target: { kind: 'slot', entity: 'study', path: 'description' },
            value: record.description as never,
        };
        const store = open();
        store.session.getState().emitBatch([ACCEPT_GRP_A, edit]);
        answerPending(store, (op) => [op.type === 'verdict' ? CLEAR_GRP_A : undoEdit]);
        expect(store.session.getState().undoStack).toHaveLength(1);
        store.session.getState().undo();
        expect(withoutIds(store.session.getState().pending)).toEqual([undoEdit, CLEAR_GRP_A]);
        expect(groupsOfPending(store).size).toBe(1);
    });

    it('drops the step of an op confirmed without an inverse', () => {
        const store = open();
        store.session.getState().emit(LINK);
        answerPending(store, () => undefined);
        expect(store.session.getState().undoStack).toEqual([]);
        store.session.getState().undo();
        expect(pendingIds(store)).toEqual([]);
    });

    it('drops the step of an op a rebase finds stored, whose inverse it never saw', () => {
        const store = open();
        store.session.getState().emit(LINK);
        store.session.getState().emit(CREATE);
        const { bundle } = store.session.getState();
        store.session.getState().rebase({
            ...bundle,
            ops: [{ seq: 1, op: LINK, before: {}, after: {}, user_id: 'u1', created_at: 'then' }],
        });
        expect(pendingIds(store)).toEqual(['create-0001']);
        expect(store.session.getState().undoStack).toHaveLength(1);
        answerPending(store, () => [DELETE_C]);
        store.session.getState().undo();
        expect(withoutIds(store.session.getState().pending)).toEqual([DELETE_C]);
    });

    it('drops a whole step when a rebase finds one of its ops stored, though another is still pending', () => {
        const store = open();
        store.session.getState().emitBatch([LINK, CREATE]);
        const { bundle } = store.session.getState();
        store.session.getState().rebase({
            ...bundle,
            ops: [{ seq: 1, op: LINK, before: {}, after: {}, user_id: 'u1', created_at: 'then' }],
        });
        expect(pendingIds(store)).toEqual(['create-0001']);
        answerPending(store, () => [DELETE_C]);
        expect(store.session.getState().undoStack).toEqual([]);
        store.session.getState().undo();
        expect(pendingIds(store)).toEqual([]);
    });

    it('a confirmed op carries no inverse in the store’s ops', () => {
        const store = open();
        store.session.getState().emit(LINK);
        answerPending(store, () => [UNLINK]);
        expect(store.session.getState().ops.every((stored) => !('inverse' in stored))).toBe(true);
        expect(store.session.getState().ops).toHaveLength(1);
    });
});

describe('undo and redo through the test server', () => {
    const source = makeBundle({ description: ev('A study') }, TEXT, {
        source: { ...makeBundle({}, '').source, id: 'S1', label: 'A paper' },
    });
    let server: FakeServer;
    let client: OpClient;

    async function start() {
        await server.backend.startReview('S1');
        const store = createReviewStores(await server.backend.getBundle('S1'));
        client = createOpClient(store.session, server.api());
        client.start();
        return store;
    }

    const saved = async () => {
        await vi.advanceTimersByTimeAsync(1000);
        await client.settled();
    };
    const description = (store: ReviewStores) =>
        (store.session.getState().record as { description: { value: unknown; evidence: unknown } }).description;

    beforeEach(() => {
        vi.useFakeTimers();
        server = fakeServer([source]);
    });

    afterEach(() => {
        client.stop();
        vi.useRealTimers();
        expect(server.invalid()).toEqual([]);
    });

    it('undoes and redoes a slot edit; a reload shows the redone record, and the log holds all three ops in order', async () => {
        const store = await start();
        store.session.getState().emit({
            client_op_id: 'edit-0001',
            type: 'set_value',
            target: { kind: 'slot', entity: 'study', path: 'description' },
            value: { extraction_status: 'extracted', value: 'A Stroop study', value_source: 'reported' },
        });
        await saved();
        store.session.getState().undo();
        expect(description(store).value).toBe('A study');
        await saved();
        store.session.getState().redo();
        expect(description(store).value).toBe('A Stroop study');
        await saved();
        const afterRedo = store.session.getState().record;
        const reloaded = createReviewStores(await server.backend.getBundle('S1'));
        expect(reloaded.session.getState().record).toEqual(afterRedo);
        const log = reloaded.session.getState().ops;
        expect(log.map((s) => s.seq)).toEqual([1, 2, 3]);
        expect(log.map((s) => (s.op as { value: { value: unknown } }).value.value)).toEqual([
            'A Stroop study',
            'A study',
            'A Stroop study',
        ]);
        expect(new Set(log.map((s) => s.op.client_op_id)).size).toBe(3);
    });

    it('undoes and redoes an evidence edit', async () => {
        const store = await start();
        store.view.getState().focusSlot(slotKey('study', 'description'));
        store.session.getState().addEvidence(store.view.getState().focus.key, [0, 15], 'new');
        await saved();
        const added = description(store).evidence;
        store.session.getState().undo();
        expect(description(store).evidence).toEqual({ status: 'not_found' });
        await saved();
        store.session.getState().redo();
        expect(description(store).evidence).toEqual(added);
        await saved();
        expect((await server.backend.getBundle('S1')).record).toEqual(store.session.getState().record);
    });

    it('undoes and redoes an evidence edit on text with an astral character before the span, the spans exact', async () => {
        const wide = '\u{1D465} = 1. Twenty patients performed a Stroop task.';
        const twenty: [number, number] = [7, 13];
        const astral = makeBundle({ description: ev('A study', [twenty]) }, wide, {
            source: { ...makeBundle({}, '').source, id: 'S2', label: 'A paper' },
        });
        server = fakeServer([astral]);
        await server.backend.startReview('S2');
        const store = createReviewStores(await server.backend.getBundle('S2'));
        client = createOpClient(store.session, server.api());
        client.start();
        const offsets = () =>
            (description(store).evidence as { sets: { spans: { start_char: number; end_char: number }[] }[] }).sets.map(
                (set) => set.spans.map(({ start_char, end_char }) => [start_char, end_char])
            );
        const before = offsets();
        const utf16 = (word: string) => [wide.indexOf(word), wide.indexOf(word) + word.length] as [number, number];
        store.view.getState().focusSlot(slotKey('study', 'description'));
        store.session.getState().addEvidence(store.view.getState().focus.key, utf16('patients'), 'first');
        await saved();
        const added = offsets();
        expect(added).not.toEqual(before);
        store.session.getState().undo();
        await saved();
        expect(offsets()).toEqual(before);
        expect(before).toEqual([[[8, 14]]]);
        store.session.getState().redo();
        await saved();
        expect(offsets()).toEqual(added);
        const reloaded = createReviewStores(await server.backend.getBundle('S2'));
        expect(description(reloaded).evidence).toEqual(description(store).evidence);
    });
});
