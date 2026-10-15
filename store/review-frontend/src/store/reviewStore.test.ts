import { createHash } from 'node:crypto';
import type { OpResult } from '../api/reviewApi';
import type { Provenance, ReviewBundle, StoredOp } from '../contract/generated/review-bundle';
import type { Op } from '../contract/generated/review-ops';
import { validateOpBatch } from '../test/schemas';
import { entityRows, ev, makeBundle, notReported, row } from '../test/bundles';
import { createReviewStore } from './reviewStore';

const TEXT = 'x'.repeat(300);

const record = {
    description: ev('A study', [[0, 10]], 'generated'),
    groups: [
        {
            local_id: 'grp_a',
            name: ev('Patients', [[50, 58]]),
            description: {
                ...ev('desc'),
                evidence: {
                    status: 'present',
                    sets: [
                        { source: 'model_quote', spans: [{ start_char: 90, end_char: 95, text: 'xxxxx' }] },
                        { source: null, spans: [{ start_char: 5, end_char: 9 }] },
                    ],
                    unlocated_quotes: 1,
                },
            },
            species: notReported(),
            sex: ev('mixed'),
        },
        { local_id: 'grp_b', name: ev('Controls', [[60, 68]]) },
    ],
    analyses: [{ local_id: 'a_hidden', name: ev('Hidden', [[200, 210]]) }],
};

const entities = entityRows(
    row('grp_a', 'Group', 'groups'),
    row('grp_b', 'Group', 'groups'),
    row('a_hidden', 'Analysis', 'analyses')
);

const storedOp: StoredOp = {
    seq: 1,
    op: {
        client_op_id: 'stored-0001',
        type: 'verdict',
        target: { kind: 'entity', entity: 'grp_b' },
        verdict: 'accept',
    },
    before: {},
    after: {},
    user_id: 'u1',
    created_at: '2026-10-14T12:00:00Z',
};

function setup() {
    const bundle = makeBundle(record, TEXT, {
        entities,
        ops: [storedOp],
        hidden: { analyses: ['a_hidden'], entities: [] },
    });
    return createReviewStore(bundle);
}

describe('review store navigation', () => {
    it('starts on the first entity, focused by its target key', () => {
        const store = setup();
        expect(store.getState().focus).toEqual({ entity: 'study', key: 'entity:study' });
    });

    it('steps through the focused entity’s slots in inspector order and stops at the ends', () => {
        const store = setup();
        store.getState().focusEntity('grp_a');
        const seen = [1, 1, 1, 1, 1].map(() => {
            store.getState().moveSlot(1);
            return store.getState().focus.key;
        });
        expect(seen).toEqual([
            'slot:grp_a:sex',
            'slot:grp_a:species',
            'slot:grp_a:name',
            'slot:grp_a:description',
            'slot:grp_a:description',
        ]);
        store.getState().moveSlot(-1);
        expect(store.getState().focus).toEqual({ entity: 'grp_a', key: 'slot:grp_a:name' });
    });

    it('steps through visible entities, skipping hidden ones', () => {
        const store = setup();
        const seen = [1, 1, 1, 1].map(() => {
            store.getState().moveEntity(1);
            return store.getState().focus.entity;
        });
        expect(seen).toEqual(['grp_a', 'grp_b', 'grp_b', 'grp_b']);
        store.getState().moveEntity(-1);
        expect(store.getState().focus).toEqual({ entity: 'grp_a', key: 'entity:grp_a' });
    });

    it('steps through the focused item’s evidence and wraps', () => {
        const store = setup();
        store.getState().focusSlot('slot:grp_a:description');
        expect(store.getState().focusedSpans).toEqual([
            [5, 9],
            [90, 95],
        ]);
        expect(store.getState().evidenceCursor).toBe(0);
        store.getState().stepEvidence(1);
        expect(store.getState().evidenceCursor).toBe(1);
        store.getState().stepEvidence(1);
        expect(store.getState().evidenceCursor).toBe(0);
        store.getState().stepEvidence(-1);
        expect(store.getState().evidenceCursor).toBe(1);
    });

    it('focuses an entity’s evidence as the union of its slots’ spans', () => {
        const store = setup();
        store.getState().focusEntity('grp_a');
        expect(store.getState().focusedSpans).toEqual([
            [5, 9],
            [50, 58],
            [90, 95],
        ]);
    });

    it('asks the text to reveal the first span on focus and the span stepped to, each time with a new seq', () => {
        const store = setup();
        store.getState().focusSlot('slot:grp_a:description');
        const first = store.getState().reveal;
        expect(first?.span).toEqual([5, 9]);
        store.getState().stepEvidence(1);
        expect(store.getState().reveal).toEqual({ span: [90, 95], seq: first!.seq + 1 });
        store.getState().focusSlot('slot:grp_a:description');
        expect(store.getState().reveal).toEqual({ span: [5, 9], seq: first!.seq + 2 });
        expect(store.getState().evidenceCursor).toBe(0);
        store.getState().focusSlot('slot:grp_a:sex');
        expect(store.getState().reveal?.seq).toBe(first!.seq + 2);
    });
});

describe('adding evidence', () => {
    it('seeds the op log from the bundle and keeps the new op pending', () => {
        const store = setup();
        expect(store.getState().ops).toEqual([storedOp]);
        store.getState().focusSlot('slot:grp_a:name');
        store.getState().addEvidence([120, 130], 'first');
        expect(store.getState().ops).toEqual([storedOp]);
        expect(store.getState().pending).toHaveLength(1);
    });

    it('adds a span to the focused slot’s first set, keeping each set’s source and the unlocated quotes', () => {
        const store = setup();
        store.getState().focusSlot('slot:grp_a:description');
        expect(store.getState().addEvidence([120, 130], 'first')).toBe(true);
        const { pending } = store.getState();
        expect(validateOpBatch({ ops: pending })).toBe(true);
        expect(pending).toEqual([
            {
                client_op_id: expect.any(String),
                type: 'set_evidence',
                target: { kind: 'slot', entity: 'grp_a', path: 'description' },
                evidence: {
                    status: 'present',
                    sets: [
                        {
                            source: 'model_quote',
                            spans: [
                                { start_char: 90, end_char: 95 },
                                { start_char: 120, end_char: 130 },
                            ],
                        },
                        { source: null, spans: [{ start_char: 5, end_char: 9 }] },
                    ],
                    unlocated_quotes: 1,
                },
            },
        ]);
        expect(store.getState().focusedSpans).toContainEqual([120, 130]);
    });

    it('adds a span as a new set with no source, and to a slot that had no evidence', () => {
        const store = setup();
        store.getState().focusSlot('slot:grp_a:sex');
        store.getState().addEvidence([20, 25], 'first');
        store.getState().addEvidence([30, 35], 'new');
        const [first, second] = store.getState().pending;
        expect(validateOpBatch({ ops: [first, second] })).toBe(true);
        expect(first).toMatchObject({
            evidence: { status: 'present', sets: [{ spans: [{ start_char: 20, end_char: 25 }] }] },
        });
        expect(second).toMatchObject({
            evidence: {
                sets: [{ spans: [{ start_char: 20, end_char: 25 }] }, { spans: [{ start_char: 30, end_char: 35 }] }],
            },
        });
        expect(second.type === 'set_evidence' && second.evidence.sets?.[1]).not.toHaveProperty('source');
        expect(first.client_op_id).not.toBe(second.client_op_id);
    });

    it('updates the slot from the edited record: its spans, its doubt and every span in the text', () => {
        const store = setup();
        store.getState().focusSlot('slot:grp_a:sex');
        store.getState().addEvidence([20, 25], 'first');
        const { index, record } = store.getState();
        expect(index.slot('slot:grp_a:sex')).toMatchObject({ spans: [[20, 25]], doubt: 'other' });
        expect(index.entity('grp_a')?.spans).toContainEqual([20, 25]);
        expect(index.allSpans).toContainEqual([20, 25]);
        expect((record.groups as { sex: unknown }[])[0].sex).toMatchObject({ evidence: { status: 'present' } });
    });

    it('keeps an edited slot in its place while it is focused and sorts it once focus moves on', () => {
        const store = setup();
        const order = () =>
            store
                .getState()
                .index.entity('grp_a')!
                .slots.map((s) => s.path);
        expect(order()).toEqual(['sex', 'species', 'name', 'description']);
        store.getState().focusSlot('slot:grp_a:sex');
        store.getState().addEvidence([20, 25], 'first');
        expect(order()).toEqual(['sex', 'species', 'name', 'description']);
        store.getState().focusSlot('slot:grp_a:name');
        expect(order()).toEqual(['species', 'sex', 'name', 'description']);
    });

    it('refuses a pending op by its client_op_id, whichever copy of it the refusal carries', () => {
        const store = setup();
        store.getState().focusSlot('slot:grp_a:name');
        store.getState().addEvidence([120, 130], 'first');
        const [op] = store.getState().pending;
        store.getState().refuse([{ op: { ...op }, message: 'too long' }]);
        expect(store.getState().pending).toEqual([]);
        expect(store.getState().notices).toEqual([expect.objectContaining({ kind: 'refused', message: 'too long' })]);
    });

    it('refuses evidence on a slot that is not extracted', () => {
        const store = setup();
        store.getState().focusSlot('slot:grp_a:species');
        expect(store.getState().addEvidence([20, 25], 'first')).toBe(false);
        expect(store.getState().pending).toEqual([]);
    });

    it('targets the root study by "study" and does nothing without a focused slot', () => {
        const store = setup();
        expect(store.getState().addEvidence([1, 2], 'first')).toBe(false);
        store.getState().focusSlot('slot:study:description');
        store.getState().addEvidence([1, 2], 'first');
        expect(store.getState().pending[0]).toMatchObject({
            target: { kind: 'slot', entity: 'study', path: 'description' },
        });
    });
});

describe('emitting ops', () => {
    const review = {
        id: 'r1',
        user_id: 'u1',
        state: 'in_progress',
        last_seq: 0,
        provenance: {},
        annotations: {},
    } as const;
    const open = (overrides: Partial<ReviewBundle> = {}) =>
        createReviewStore(makeBundle(record, TEXT, { entities, review: { ...review }, ...overrides }), {
            now: () => 'now',
        });
    const mark = (state: Provenance['state']) => ({ state, user_id: 'u1', at: 'now' });
    const setName = (entity: string, value: string): Op => ({
        client_op_id: `name-${entity}`,
        type: 'set_value',
        target: { kind: 'slot', entity, path: 'name' },
        value: { extraction_status: 'extracted', value },
    });
    const createGroup: Op = {
        client_op_id: 'create-0001',
        type: 'create_entity',
        parent: 'study',
        list: 'groups',
        entity: { name: ev('Siblings') },
    };
    const minted = (clientOpId: string) => `rv_${createHash('sha256').update(clientOpId).digest('hex').slice(0, 12)}`;
    const groupsOf = (store: ReturnType<typeof open>) =>
        store.getState().record.groups as { name: { value: string } }[];

    it('applies a set_value at once, with its provenance, and keeps it pending', async () => {
        const store = open();
        expect(await store.getState().emit(setName('grp_b', 'Siblings'))).toBe(true);
        const state = store.getState();
        expect(groupsOf(store)[1].name).toEqual({
            extraction_status: 'extracted',
            value: 'Siblings',
            evidence: ev('Controls', [[60, 68]]).evidence,
        });
        expect(state.provenance).toEqual({ 'slot:grp_b:name': mark('edited') });
        expect(state.index.slot('slot:grp_b:name')?.value?.value).toBe('Siblings');
        expect(state.pending).toEqual([setName('grp_b', 'Siblings')]);
    });

    it('shows a slot a set_value creates', async () => {
        const store = open();
        expect(store.getState().index.slot('slot:grp_b:species')).toBeUndefined();
        await store.getState().emit({
            client_op_id: 'species-1',
            type: 'set_value',
            target: { kind: 'slot', entity: 'grp_b', path: 'species' },
            value: { extraction_status: 'extracted', value: 'human' },
        });
        expect(store.getState().index.slot('slot:grp_b:species')?.value).toMatchObject({ value: 'human' });
    });

    it('applies a verdict and entity evidence to the provenance and annotations, leaving the record', async () => {
        const store = open();
        const before = store.getState().record;
        await store.getState().emit({
            client_op_id: 'v-1',
            type: 'verdict',
            target: { kind: 'entity', entity: 'grp_a' },
            verdict: 'reject',
            reason: 'duplicate',
        });
        await store.getState().emit({
            client_op_id: 'e-1',
            type: 'set_evidence',
            target: { kind: 'entity', entity: 'grp_b' },
            evidence: { status: 'present', sets: [{ spans: [{ start_char: 1, end_char: 3 }] }] },
        });
        const state = store.getState();
        expect(state.record).toBe(before);
        expect(state.provenance).toEqual({ 'entity:grp_a': mark('removed'), 'entity:grp_b': mark('edited') });
        expect(state.annotations).toEqual({
            'entity:grp_b': { status: 'present', sets: [{ spans: [{ start_char: 1, end_char: 3, text: 'xx' }] }] },
        });
    });

    it('refuses an op the core refuses: nothing pending, and a notice naming its target', async () => {
        const store = open();
        expect(await store.getState().emit(setName('grp_x', 'Nobody'))).toBe(false);
        expect(store.getState().pending).toEqual([]);
        expect(store.getState().notices).toEqual([
            { kind: 'refused', slot: 'grp_x name', message: "no entity has local_id 'grp_x'" },
        ]);
    });

    it('holds a create_entity pending unapplied, with a local_id minted from its client_op_id', async () => {
        const store = open();
        const before = store.getState().record;
        expect(store.getState().emit(createGroup)).toBe(true);
        expect(store.getState().record).toBe(before);
        expect(store.getState().pending).toEqual([createGroup]);
        await store.getState().minted('create-0001');
        expect(store.getState().record).toBe(before);
        expect(store.getState().pending).toEqual([
            { ...createGroup, entity: { local_id: minted('create-0001'), name: ev('Siblings') } },
        ]);
    });

    it('mints a local_id clear of the entities it knows, as the core does', async () => {
        const store = open({ entities: [...entities, row(minted('create-0001'), 'Group', 'groups')] });
        store.getState().emit(createGroup);
        await store.getState().minted('create-0001');
        expect(store.getState().pending[0]).toMatchObject({ entity: { local_id: `${minted('create-0001')}_2` } });
    });

    it('holds the ops emitted after a pending structural op, in the order they were emitted', async () => {
        const store = open();
        const before = store.getState().record;
        const creating = store.getState().emit(createGroup);
        const naming = store.getState().emit(setName('grp_a', 'Cases'));
        expect(await creating).toBe(true);
        expect(await naming).toBe(true);
        expect(store.getState().pending.map((op) => op.client_op_id)).toEqual(['create-0001', 'name-grp_a']);
        expect(store.getState().record).toBe(before);
        expect(store.getState().provenance).toEqual({});
    });

    it('keeps a pending structural op and the ops held behind it, in order and unapplied', () => {
        const store = createReviewStore(makeBundle(record, TEXT, { entities, review: { ...review } }), {
            now: () => 'now',
        });
        store.getState().emit(setName('grp_b', 'Siblings'));
        store.getState().emit(createGroup);
        store.getState().emit(setName('grp_a', 'Cases'));
        store.getState().rebase(makeBundle(record, TEXT, { entities, review: { ...review, last_seq: 1 } }));
        expect(store.getState().pending.map((op) => op.client_op_id)).toEqual([
            'name-grp_b',
            'create-0001',
            'name-grp_a',
        ]);
        expect(store.getState().pending[2]).toEqual(setName('grp_a', 'Cases'));
    });

    it('a rebase leaves the set_value held behind a pending create unapplied, with the create still first', async () => {
        const store = open();
        store.getState().emit(createGroup);
        await store.getState().emit(setName('grp_a', 'Cases'));
        const fresh = makeBundle(record, TEXT, { entities, review: { ...review, last_seq: 1 } });
        store.getState().rebase(fresh);
        expect(store.getState().pending.map((op) => op.client_op_id)).toEqual(['create-0001', 'name-grp_a']);
        expect(store.getState().record).toEqual(fresh.record);
        expect(store.getState().provenance).toEqual({});
        expect(groupsOf(store)[0].name.value).toBe('Patients');
    });

    it('mints a local_id clear of the pending creates’ ids, as the core would after them', async () => {
        const store = open();
        store.getState().emit({
            ...createGroup,
            client_op_id: 'create-0002',
            entity: { local_id: minted('create-0001'), name: ev('Earlier') },
        });
        store.getState().emit(createGroup);
        await store.getState().minted('create-0001');
        expect(store.getState().pending[1]).toMatchObject({ entity: { local_id: `${minted('create-0001')}_2` } });
    });

    it('takes the documents, hidden set and entity index from the structural op’s result, then applies the held ops', async () => {
        const store = open();
        await store.getState().emit(createGroup);
        const [created] = store.getState().pending;
        const id = minted('create-0001');
        await store.getState().emit(setName(id, 'Cousins'));
        const result: OpResult = {
            ops: [{ seq: 1, op: created, before: {}, after: {}, user_id: 'u1', created_at: 'then' }],
            last_seq: 1,
            record: { ...record, groups: [...record.groups, { local_id: id, name: ev('Siblings') }] },
            coordinate_revision: null,
            provenance: { [`entity:${id}`]: { state: 'added', user_id: 'u1', at: 'then' } },
            annotations: {},
            hidden: { analyses: ['a_hidden'], entities: [id] },
            entities: [...entities, row(id, 'Group', 'groups')],
        };
        store.getState().confirm(result, [created]);
        const state = store.getState();
        expect(state.bundle.entities).toEqual(result.entities);
        expect(state.bundle.hidden).toEqual(result.hidden);
        expect(state.index.entity(id)).toMatchObject({ entityClass: 'Group', hidden: true, name: 'Cousins' });
        expect(groupsOf(store)[2].name.value).toBe('Cousins');
        expect(state.provenance).toEqual({ ...result.provenance, [`slot:${id}:name`]: mark('edited') });
        expect(state.pending.map((op) => op.client_op_id)).toEqual([`name-${id}`]);
    });
});

describe('offsets outside the Basic Multilingual Plane', () => {
    const WIDE = 'Den 𝛼 cohort: 😀 twenty patients.';
    const utf16 = (words: string): [number, number] => [WIDE.indexOf(words), WIDE.indexOf(words) + words.length];
    const codePoints = (words: string): [number, number] => {
        const start = [...WIDE.slice(0, WIDE.indexOf(words))].length;
        return [start, start + [...words].length];
    };

    it('reads the bundle’s spans as UTF-16 units, so each span covers the characters it names', () => {
        const bundle = makeBundle({ description: ev('A study', [codePoints('twenty')]) }, WIDE);
        const store = createReviewStore(bundle);
        expect(store.getState().index.slot('slot:study:description')?.spans).toEqual([utf16('twenty')]);
        expect(WIDE.slice(...utf16('twenty'))).toBe('twenty');
    });

    it('keeps an added span at the characters the reviewer picked', () => {
        const store = createReviewStore(makeBundle({ description: ev('A study') }, WIDE));
        store.getState().focusSlot('slot:study:description');
        expect(store.getState().addEvidence(utf16('twenty'), 'new')).toBe(true);
        expect(store.getState().index.slot('slot:study:description')?.spans).toEqual([utf16('twenty')]);
    });
});
