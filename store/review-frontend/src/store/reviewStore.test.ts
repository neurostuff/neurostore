import type { StoredOp } from '../contract/generated/review-bundle';
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
