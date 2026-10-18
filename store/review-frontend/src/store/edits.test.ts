import { createHash } from 'node:crypto';
import type { OpResult } from '../api/reviewApi';
import type { Provenance, ReviewBundle } from '../contract/generated/review-bundle';
import type { Evidence, Op, SetEvidenceOp } from '../contract/generated/review-ops';
import type { Schema } from '../model/schema';
import { setSchemas } from '../contract/schemas';
import { GOLDEN_SCHEMAS } from '../test/goldenSchemas';
import { validateOpBatch } from '../test/schemas';
import { ev, makeBundle, row } from '../test/bundles';
import type { Json } from '../model/paths';
import { KEPT_REFUSED } from './keptOps';
import { createReviewStores } from './reviewStores';
import { focusedSpans, shownIndex } from '../test/stores';
import { TEXT, record, entities, storedOp, setup } from '../test/storeFixture';

describe('adding evidence', () => {
    it('seeds the op log from the bundle and keeps the new op pending', () => {
        const store = setup();
        expect(store.session.getState().ops).toEqual([storedOp]);
        store.view.getState().focusSlot('slot:grp_a:name');
        store.session.getState().addEvidence(store.view.getState().focus.key, [120, 130], 'first');
        expect(store.session.getState().ops).toEqual([storedOp]);
        expect(store.session.getState().pending).toHaveLength(1);
    });

    it('adds a span to the focused slot’s first set, keeping each set’s source and the unlocated quotes', () => {
        const store = setup();
        store.view.getState().focusSlot('slot:grp_a:description');
        expect(store.session.getState().addEvidence(store.view.getState().focus.key, [120, 130], 'first')).toBe(true);
        const { pending } = store.session.getState();
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
        expect(focusedSpans(store)).toContainEqual([120, 130]);
    });

    it('adds a span as a new set with no source, and to a slot that had no evidence', () => {
        const store = setup();
        store.view.getState().focusSlot('slot:grp_a:sex');
        store.session.getState().addEvidence(store.view.getState().focus.key, [20, 25], 'first');
        store.session.getState().addEvidence(store.view.getState().focus.key, [30, 35], 'new');
        const [first, second] = store.session.getState().pending;
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
        store.view.getState().focusSlot('slot:grp_a:sex');
        store.session.getState().addEvidence(store.view.getState().focus.key, [20, 25], 'first');
        const { index, record } = store.session.getState();
        expect(index.slot('slot:grp_a:sex')).toMatchObject({ spans: [[20, 25]], doubt: 'other' });
        expect(index.entity('grp_a')?.spans).toContainEqual([20, 25]);
        expect(index.allSpans).toContainEqual([20, 25]);
        expect((record.groups as { sex: unknown }[])[0].sex).toMatchObject({ evidence: { status: 'present' } });
    });

    it('keeps an edited slot in its declared place, while it is focused and once focus moves on', () => {
        const store = setup();
        const order = () =>
            shownIndex(store)
                .entity('grp_a')!
                .slots.filter((s) => s.value !== undefined)
                .map((s) => s.path);
        // The LinkML's order for Group: name, description, species, then sex.
        const declared = ['name', 'description', 'species', 'sex'];
        expect(order()).toEqual(declared);
        store.view.getState().focusSlot('slot:grp_a:sex');
        store.session.getState().addEvidence(store.view.getState().focus.key, [20, 25], 'first');
        expect(order()).toEqual(declared);
        store.view.getState().focusSlot('slot:grp_a:name');
        expect(order()).toEqual(declared);
    });

    it('refuses a pending op by its client_op_id, whichever copy of it the refusal carries', () => {
        const store = setup();
        store.view.getState().focusSlot('slot:grp_a:name');
        store.session.getState().addEvidence(store.view.getState().focus.key, [120, 130], 'first');
        const [op] = store.session.getState().pending;
        store.session.getState().refuse([{ op: { ...op }, message: 'too long' }]);
        expect(store.session.getState().pending).toEqual([]);
        expect(store.session.getState().notices).toEqual([
            expect.objectContaining({ kind: 'refused', message: 'too long' }),
        ]);
    });

    it('refuses evidence on a slot that is not extracted', () => {
        const store = setup();
        store.view.getState().focusSlot('slot:grp_a:species');
        expect(store.session.getState().addEvidence(store.view.getState().focus.key, [20, 25], 'first')).toBe(false);
        expect(store.session.getState().pending).toEqual([]);
    });

    it('targets the root study by "study" and does nothing without a focused slot', () => {
        const store = setup();
        expect(store.session.getState().addEvidence(store.view.getState().focus.key, [1, 2], 'first')).toBe(false);
        store.view.getState().focusSlot('slot:study:description');
        store.session.getState().addEvidence(store.view.getState().focus.key, [1, 2], 'first');
        expect(store.session.getState().pending[0]).toMatchObject({
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
        createReviewStores(makeBundle(record, TEXT, { entities, review: { ...review }, ...overrides }), {
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
        store.session.getState().record.groups as { name: { value: string } }[];

    it('applies a set_value at once, with its provenance, and keeps it pending', async () => {
        const store = open();
        expect(await store.session.getState().emit(setName('grp_b', 'Siblings'))).toBe(true);
        const state = store.session.getState();
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
        expect(store.session.getState().index.slot('slot:grp_b:species')?.value).toBeUndefined();
        await store.session.getState().emit({
            client_op_id: 'species-1',
            type: 'set_value',
            target: { kind: 'slot', entity: 'grp_b', path: 'species' },
            value: { extraction_status: 'extracted', value: 'human' },
        });
        expect(store.session.getState().index.slot('slot:grp_b:species')?.value).toMatchObject({ value: 'human' });
    });

    it('applies a verdict and entity evidence to the provenance and annotations, leaving the record', async () => {
        const store = open();
        const before = store.session.getState().record;
        await store.session.getState().emit({
            client_op_id: 'v-1',
            type: 'verdict',
            target: { kind: 'entity', entity: 'grp_a' },
            verdict: 'reject',
            reason: 'duplicate',
        });
        await store.session.getState().emit({
            client_op_id: 'e-1',
            type: 'set_evidence',
            target: { kind: 'entity', entity: 'grp_b' },
            evidence: { status: 'present', sets: [{ spans: [{ start_char: 1, end_char: 3 }] }] },
        });
        const state = store.session.getState();
        expect(state.record).toBe(before);
        expect(state.provenance).toEqual({ 'entity:grp_a': mark('removed'), 'entity:grp_b': mark('edited') });
        expect(state.annotations).toEqual({
            'entity:grp_b': { status: 'present', sets: [{ spans: [{ start_char: 1, end_char: 3, text: 'xx' }] }] },
        });
    });

    it('refuses an op the core refuses: nothing pending, and a notice naming its target', async () => {
        const store = open();
        expect(await store.session.getState().emit(setName('grp_x', 'Nobody'))).toBe(false);
        expect(store.session.getState().pending).toEqual([]);
        expect(store.session.getState().notices).toEqual([
            { kind: 'refused', slot: 'grp_x name', message: "no entity has local_id 'grp_x'", op: expect.anything() },
        ]);
    });

    it('holds a create_entity pending unapplied, with a local_id minted from its client_op_id', async () => {
        const store = open();
        const before = store.session.getState().record;
        expect(store.session.getState().emit(createGroup)).toBe(true);
        expect(store.session.getState().record).toBe(before);
        expect(store.session.getState().pending).toEqual([createGroup]);
        await store.session.getState().minted('create-0001');
        expect(store.session.getState().record).toBe(before);
        expect(store.session.getState().pending).toEqual([
            { ...createGroup, entity: { local_id: minted('create-0001'), name: ev('Siblings') } },
        ]);
    });

    it('mints a local_id clear of the entities it knows, as the core does', async () => {
        const store = open({ entities: [...entities, row(minted('create-0001'), 'Group', 'groups')] });
        store.session.getState().emit(createGroup);
        await store.session.getState().minted('create-0001');
        expect(store.session.getState().pending[0]).toMatchObject({
            entity: { local_id: `${minted('create-0001')}_2` },
        });
    });

    it('holds the ops emitted after a pending structural op, in the order they were emitted', async () => {
        const store = open();
        const before = store.session.getState().record;
        const creating = store.session.getState().emit(createGroup);
        const naming = store.session.getState().emit(setName('grp_a', 'Cases'));
        expect(await creating).toBe(true);
        expect(await naming).toBe(true);
        expect(store.session.getState().pending.map((op) => op.client_op_id)).toEqual(['create-0001', 'name-grp_a']);
        expect(store.session.getState().record).toBe(before);
        expect(store.session.getState().provenance).toEqual({});
    });

    it('keeps a pending structural op and the ops held behind it, in order and unapplied', () => {
        const store = createReviewStores(makeBundle(record, TEXT, { entities, review: { ...review } }), {
            now: () => 'now',
        });
        store.session.getState().emit(setName('grp_b', 'Siblings'));
        store.session.getState().emit(createGroup);
        store.session.getState().emit(setName('grp_a', 'Cases'));
        store.session.getState().rebase(makeBundle(record, TEXT, { entities, review: { ...review, last_seq: 1 } }));
        expect(store.session.getState().pending.map((op) => op.client_op_id)).toEqual([
            'name-grp_b',
            'create-0001',
            'name-grp_a',
        ]);
        expect(store.session.getState().pending[2]).toEqual(setName('grp_a', 'Cases'));
    });

    it('a rebase leaves the set_value held behind a pending create unapplied, with the create still first', async () => {
        const store = open();
        store.session.getState().emit(createGroup);
        await store.session.getState().emit(setName('grp_a', 'Cases'));
        const fresh = makeBundle(record, TEXT, { entities, review: { ...review, last_seq: 1 } });
        store.session.getState().rebase(fresh);
        expect(store.session.getState().pending.map((op) => op.client_op_id)).toEqual(['create-0001', 'name-grp_a']);
        expect(store.session.getState().record).toEqual(fresh.record);
        expect(store.session.getState().provenance).toEqual({});
        expect(groupsOf(store)[0].name.value).toBe('Patients');
    });

    it('mints a local_id clear of the pending creates’ ids, as the core would after them', async () => {
        const store = open();
        store.session.getState().emit({
            ...createGroup,
            client_op_id: 'create-0002',
            entity: { local_id: minted('create-0001'), name: ev('Earlier') },
        });
        store.session.getState().emit(createGroup);
        await store.session.getState().minted('create-0001');
        expect(store.session.getState().pending[1]).toMatchObject({
            entity: { local_id: `${minted('create-0001')}_2` },
        });
    });

    it('takes the documents, hidden set and entity index from the structural op’s result, then applies the held ops', async () => {
        const store = open();
        await store.session.getState().emit(createGroup);
        const [created] = store.session.getState().pending;
        const id = minted('create-0001');
        await store.session.getState().emit(setName(id, 'Cousins'));
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
        store.session.getState().confirm(result, [created]);
        const state = store.session.getState();
        expect(state.bundle.entities).toEqual(result.entities);
        expect(state.bundle.hidden).toEqual(result.hidden);
        expect(state.index.entity(id)).toMatchObject({ entityClass: 'Group', hidden: true, name: 'Cousins' });
        expect(groupsOf(store)[2].name.value).toBe('Cousins');
        expect(state.provenance).toEqual({ ...result.provenance, [`slot:${id}:name`]: mark('edited') });
        expect(state.pending.map((op) => op.client_op_id)).toEqual([`name-${id}`]);
    });

    const answer = (sent: Op, record: Json, rows: ReviewBundle['entities']): OpResult => ({
        ops: [{ seq: 1, op: sent, before: {}, after: {}, user_id: 'u1', created_at: 'then' }],
        last_seq: 1,
        record,
        coordinate_revision: null,
        provenance: {},
        annotations: {},
        hidden: { analyses: ['a_hidden'], entities: [] },
        entities: rows,
    });

    it('focuses the entity a create_entity made once the server answers', async () => {
        const store = open();
        store.view.getState().focusEntity('grp_b');
        store.session.getState().emit(createGroup);
        await store.session.getState().minted('create-0001');
        const [created] = store.session.getState().pending;
        const id = minted('create-0001');
        expect(store.view.getState().focus.entity).toBe('grp_b');
        store.session
            .getState()
            .confirm(
                answer(created, { ...record, groups: [...record.groups, { local_id: id, name: ev('Siblings') }] }, [
                    ...entities,
                    row(id, 'Group', 'groups'),
                ]),
                [created]
            );
        expect(store.view.getState().focus).toEqual({ entity: id, key: `entity:${id}` });
    });

    it('focuses the parent of a focused entity the server deleted', () => {
        const store = open();
        store.view.getState().focusSlot('slot:grp_b:name');
        const deletion: Op = {
            client_op_id: 'delete-0001',
            type: 'delete_entity',
            target: { kind: 'entity', entity: 'grp_b' },
        };
        store.session.getState().emit(deletion);
        expect(store.view.getState().focus.entity).toBe('grp_b');
        store.session.getState().confirm(
            answer(
                deletion,
                { ...record, groups: [record.groups[0]] },
                entities.filter((e) => e.local_id !== 'grp_b')
            ),
            [deletion]
        );
        expect(store.view.getState().focus).toEqual({ entity: 'study', key: 'entity:study' });
    });

    it('reports the links the server says a delete left dangling, as notices', () => {
        const store = open();
        const deletion: Op = {
            client_op_id: 'delete-0002',
            type: 'delete_entity',
            target: { kind: 'entity', entity: 'grp_b' },
        };
        store.session.getState().emit(deletion);
        const result = answer(
            deletion,
            { ...record, groups: [record.groups[0]] },
            entities.filter((e) => e.local_id !== 'grp_b')
        );
        result.ops[0].after = {
            references: [{ entity: 'an_1', path: 'groups[group=grp_b].n', target_entity: 'grp_b' }],
        };
        store.session.getState().confirm(result, [deletion]);
        expect(store.session.getState().notices).toEqual([
            { kind: 'dangling', slot: 'an_1 groups[group=grp_b].n', message: 'it points at grp_b' },
        ]);
    });
});

describe('moving and removing evidence', () => {
    const DESCRIPTION = 'slot:grp_a:description';
    const spansOf = (store: ReturnType<typeof setup>, key: string) => store.session.getState().index.slot(key)?.spans;

    it('moves a span within its set, in one set_evidence op, keeping the other set, the source and the unlocated quotes', () => {
        const store = setup();
        expect(store.session.getState().moveEvidence(DESCRIPTION, [90, 95], [88, 97])).toBe(true);
        const { pending, undoStack } = store.session.getState();
        expect(validateOpBatch({ ops: pending })).toBe(true);
        expect(pending).toEqual([
            {
                client_op_id: expect.any(String),
                type: 'set_evidence',
                target: { kind: 'slot', entity: 'grp_a', path: 'description' },
                evidence: {
                    status: 'present',
                    sets: [
                        { source: 'model_quote', spans: [{ start_char: 88, end_char: 97 }] },
                        { source: null, spans: [{ start_char: 5, end_char: 9 }] },
                    ],
                    unlocated_quotes: 1,
                },
            },
        ]);
        expect(undoStack).toHaveLength(1);
        expect(spansOf(store, DESCRIPTION)).toEqual([
            [5, 9],
            [88, 97],
        ]);
    });

    it('removes a span, dropping a set it empties, and leaves not_found once the last span goes', () => {
        const store = setup();
        expect(store.session.getState().removeEvidence(DESCRIPTION, [5, 9])).toBe(true);
        expect(store.session.getState().pending[0]).toMatchObject({
            evidence: {
                status: 'present',
                sets: [{ source: 'model_quote', spans: [{ start_char: 90, end_char: 95 }] }],
            },
        });
        expect(store.session.getState().removeEvidence('slot:grp_a:name', [50, 58])).toBe(true);
        expect((store.session.getState().pending[1] as SetEvidenceOp).evidence).toEqual({ status: 'not_found' });
        expect(validateOpBatch({ ops: store.session.getState().pending })).toBe(true);
        expect(spansOf(store, 'slot:grp_a:name')).toEqual([]);
    });

    it('refuses a span the slot does not have, sending nothing', () => {
        const store = setup();
        expect(store.session.getState().moveEvidence(DESCRIPTION, [91, 95], [88, 97])).toBe(false);
        expect(store.session.getState().removeEvidence(DESCRIPTION, [91, 95])).toBe(false);
        expect(store.session.getState().pending).toEqual([]);
    });

    it('refuses to move or remove a span in a read-only tab', () => {
        const store = setup();
        store.session.getState().setDevice('readonly');
        expect(store.session.getState().moveEvidence(DESCRIPTION, [90, 95], [88, 97])).toBe(false);
        expect(store.session.getState().removeEvidence(DESCRIPTION, [90, 95])).toBe(false);
        expect(store.session.getState().pending).toEqual([]);
        expect(spansOf(store, DESCRIPTION)).toEqual([
            [5, 9],
            [90, 95],
        ]);
    });

    it('moves the span again on a rebase that changed the slot’s other set, rather than overwriting it', () => {
        const store = setup();
        store.session.getState().moveEvidence(DESCRIPTION, [90, 95], [88, 97]);
        const fresh = structuredClone(store.session.getState().bundle);
        const grpA = (fresh.record as { groups: { description: { evidence: Evidence } }[] }).groups[0];
        grpA.description.evidence.sets![1].spans = [{ start_char: 5, end_char: 12 }];
        store.session.getState().rebase(fresh);
        expect(spansOf(store, DESCRIPTION)).toEqual([
            [5, 12],
            [88, 97],
        ]);
    });

    describe('whose span another tab took away', () => {
        type Fresh = { record: { groups: { description: { evidence?: Evidence } }[] } };
        const cases = [
            {
                name: 'the slot keeps evidence without the span',
                edit: (store: ReturnType<typeof setup>) =>
                    store.session.getState().moveEvidence(DESCRIPTION, [90, 95], [88, 97]),
                theirs: (fresh: Fresh) => {
                    fresh.record.groups[0].description.evidence!.sets![0].spans = [{ start_char: 100, end_char: 110 }];
                },
                shown: [
                    [5, 9],
                    [100, 110],
                ],
            },
            {
                name: 'the slot has no evidence',
                edit: (store: ReturnType<typeof setup>) =>
                    store.session.getState().removeEvidence(DESCRIPTION, [90, 95]),
                theirs: (fresh: Fresh) => {
                    delete fresh.record.groups[0].description.evidence;
                },
                shown: [],
            },
        ];

        const editedThenTaken = (c: (typeof cases)[number]) => {
            const store = setup();
            expect(c.edit(store)).toBe(true);
            const fresh = structuredClone(store.session.getState().bundle);
            c.theirs(fresh as unknown as Fresh);
            return { store, fresh };
        };

        it.each(cases)('is dropped on a rebase with a conflict notice and its undo step, when $name', (c) => {
            const { store, fresh } = editedThenTaken(c);
            store.session.getState().rebase(fresh);
            const { pending, undoStack, notices } = store.session.getState();
            expect(pending).toEqual([]);
            expect(undoStack).toEqual([]);
            expect(notices).toEqual([
                { kind: 'conflict', slot: 'grp_a description', message: expect.any(String), op: expect.anything() },
            ]);
            expect(spansOf(store, DESCRIPTION)).toEqual(c.shown);
        });

        it.each(cases)('blocks saving when restored from the device, when $name', (c) => {
            const { store, fresh } = editedThenTaken(c);
            const { pending, groupOf, intents } = store.session.getState();
            const reloaded = createReviewStores(fresh);
            reloaded.session.getState().restore({ ops: pending, groupOf, intents });
            const state = reloaded.session.getState();
            expect(state.blocked).toMatchObject({ clientOpIds: [pending[0].client_op_id], reason: KEPT_REFUSED });
            expect(state.pending).toEqual(pending);
            expect(spansOf(reloaded, DESCRIPTION)).toEqual(c.shown);
        });
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
        const store = createReviewStores(bundle);
        expect(store.session.getState().index.slot('slot:study:description')?.spans).toEqual([utf16('twenty')]);
        expect(WIDE.slice(...utf16('twenty'))).toBe('twenty');
    });

    it('keeps an added span at the characters the reviewer picked', () => {
        const store = createReviewStores(makeBundle({ description: ev('A study') }, WIDE));
        store.view.getState().focusSlot('slot:study:description');
        expect(store.session.getState().addEvidence(store.view.getState().focus.key, utf16('twenty'), 'new')).toBe(
            true
        );
        expect(store.session.getState().index.slot('slot:study:description')?.spans).toEqual([utf16('twenty')]);
    });
});

describe('declared slots', () => {
    it('follows the schema loaded last, not the one first read', () => {
        setup();
        const base = GOLDEN_SCHEMAS['extraction-record'] as Schema;
        const defs = base.$defs as Record<string, { properties: Record<string, unknown> }>;
        const group = defs.Group;
        setSchemas({
            ...GOLDEN_SCHEMAS,
            'extraction-record': {
                ...base,
                $defs: {
                    ...defs,
                    Group: { ...group, properties: { ...group.properties, probe: group.properties.acquired_count } },
                },
            },
        });
        const slots = setup()
            .session.getState()
            .index.entity('grp_a')!
            .slots.map((s) => s.key);
        expect(slots).toContain('slot:grp_a:probe');
    });
});

describe('moving evidence to another slot', () => {
    const spansOf = (store: ReturnType<typeof setup>, key: string) => store.session.getState().index.slot(key)?.spans;

    it('takes the span off one slot and adds it to another, as one intent and one undo step', () => {
        const store = setup();
        expect(store.session.getState().transferEvidence('slot:grp_a:name', [50, 58], 'slot:grp_b:name')).toBe(true);
        expect(spansOf(store, 'slot:grp_a:name')).toEqual([]);
        expect(spansOf(store, 'slot:grp_b:name')).toEqual([
            [50, 58],
            [60, 68],
        ]);
        const { pending, groupOf, undoStack } = store.session.getState();
        expect(pending.map((op) => op.type)).toEqual(['set_evidence', 'set_evidence']);
        expect(new Set(pending.map((op) => groupOf[op.client_op_id])).size).toBe(1);
        expect(undoStack).toHaveLength(1);
        expect(validateOpBatch({ ops: pending })).toBe(true);
    });

    it('refuses a move to a slot that takes no evidence, or to the slot itself, sending nothing', () => {
        const store = setup();
        expect(store.session.getState().transferEvidence('slot:grp_a:name', [50, 58], 'slot:grp_a:species')).toBe(
            false
        );
        expect(store.session.getState().transferEvidence('slot:grp_a:name', [50, 58], 'slot:grp_a:name')).toBe(false);
        expect(store.session.getState().pending).toEqual([]);
    });
});
