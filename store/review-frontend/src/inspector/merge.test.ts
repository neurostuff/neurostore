import type { ReviewBundle } from '../contract/generated/review-bundle';
import type { Op } from '../contract/generated/review-ops';
import { createReviewStore, type ReviewStore } from '../store/reviewStore';
import type { InverseOp } from '../store/undoSteps';
import { entityRows, ev, makeBundle, row } from '../test/bundles';
import { answerPending, withoutIds } from '../test/undoHelpers';
import { mergeCandidates, mergeCopies, mergeInto } from './actions';

const TEXT = 'The Beck Depression Inventory and the BDI-II were used.';
const at = (word: string): [number, number] => [TEXT.indexOf(word), TEXT.indexOf(word) + word.length];

const record = {
    groups: [
        { local_id: 'grp_a', name: ev('Patients'), diagnostic_instrument: ['asm_2'] },
        { local_id: 'grp_b', name: ev('Controls'), diagnostic_instrument: ['asm_1', 'asm_2'] },
    ],
    assessments: [
        { local_id: 'asm_1', name: ev('BDI') },
        { local_id: 'asm_2', name: ev('Beck Depression Inventory'), description: ev('depression scale', [at('Beck')]) },
    ],
};
const entities = entityRows(
    row('grp_a', 'Group', 'groups'),
    row('grp_b', 'Group', 'groups'),
    row('asm_1', 'Assessment', 'assessments'),
    row('asm_2', 'Assessment', 'assessments')
);
const review: NonNullable<ReviewBundle['review']> = {
    id: 'r1',
    user_id: 'u1',
    state: 'in_progress',
    last_seq: 0,
    provenance: {},
    annotations: {},
};
const openWith = (overrides: Partial<ReviewBundle>) =>
    createReviewStore(makeBundle(record, TEXT, { entities, review, ...overrides }), { now: () => 'now' });
const open = () => openWith({});
const shapes = (store: ReviewStore) => withoutIds(store.getState().pending);
const groups = (store: ReviewStore) => {
    const { pending, groupOf } = store.getState();
    return new Set(pending.map((op) => groupOf[op.client_op_id] ?? op.client_op_id));
};
const link = (entity: string, target_entity: string) => ({
    kind: 'relationship' as const,
    entity,
    path: 'diagnostic_instrument',
    target_entity,
});

describe('merging one record entity into another', () => {
    it('offers the other entities of its class, and the slots the kept one lacks', () => {
        const store = open();
        expect(mergeCandidates(store.getState(), 'asm_2').map((e) => e.id)).toEqual(['asm_1']);
        expect(mergeCopies(store.getState(), 'asm_2', 'asm_1').map((s) => s.path)).toEqual(['description']);
    });

    it('re-points every link, copies only the chosen slots and deletes the merged entity, as one batch', () => {
        const store = open();
        expect(mergeInto(store.getState(), 'asm_2', 'asm_1', [])).toBe(true);
        expect(shapes(store)).toEqual([
            { type: 'unlink', target: link('grp_a', 'asm_2') },
            { type: 'link', target: link('grp_a', 'asm_1') },
            { type: 'unlink', target: link('grp_b', 'asm_2') },
            { type: 'delete_entity', target: { kind: 'entity', entity: 'asm_2' } },
        ]);
        expect(groups(store).size).toBe(1);
    });

    it('copies a chosen slot with its value and evidence', () => {
        const store = open();
        mergeInto(store.getState(), 'asm_2', 'asm_1', ['description']);
        const target = { kind: 'slot', entity: 'asm_1', path: 'description' };
        expect(shapes(store)).toContainEqual({
            type: 'set_value',
            target,
            value: { extraction_status: 'extracted', value: 'depression scale', value_source: 'reported' },
        });
        expect(shapes(store)).toContainEqual({
            type: 'set_evidence',
            target,
            evidence: {
                status: 'present',
                sets: [{ spans: [{ start_char: at('Beck')[0], end_char: at('Beck')[1] }] }],
            },
        });
    });

    it('is undone as one step, every inverse in one batch, last op first', () => {
        const store = open();
        mergeInto(store.getState(), 'asm_2', 'asm_1', []);
        const inverse = (op: Op): InverseOp[] => {
            if (op.type === 'link') return [{ type: 'unlink', target: op.target }];
            if (op.type === 'unlink') return [{ type: 'link', target: op.target }];
            return [
                {
                    type: 'create_entity',
                    parent: 'study',
                    list: 'assessments',
                    index: 1,
                    entity: record.assessments[1],
                },
            ];
        };
        const sent = answerPending(store, inverse);
        store.getState().undo();
        expect(shapes(store)).toEqual(sent.flatMap(inverse).reverse());
        expect(groups(store).size).toBe(1);
        expect(store.getState().undoStack).toEqual([]);
    });

    it('re-points the links a hidden entity holds too', () => {
        const hiddenRecord = { ...record, analyses: [{ local_id: 'an_h', assessments: ['asm_2'] }] };
        const store = createReviewStore(
            makeBundle(hiddenRecord, TEXT, {
                entities: [...entities, row('an_h', 'Analysis', 'analyses')],
                hidden: { analyses: ['an_h'], entities: [] },
                review,
            }),
            { now: () => 'now' }
        );
        mergeInto(store.getState(), 'asm_2', 'asm_1', []);
        const analysisLink = (type: string, target_entity: string) => ({
            type,
            target: { kind: 'relationship', entity: 'an_h', path: 'assessments', target_entity },
        });
        expect(shapes(store)).toEqual([
            { type: 'unlink', target: link('grp_a', 'asm_2') },
            { type: 'link', target: link('grp_a', 'asm_1') },
            { type: 'unlink', target: link('grp_b', 'asm_2') },
            analysisLink('unlink', 'asm_2'),
            analysisLink('link', 'asm_1'),
            { type: 'delete_entity', target: { kind: 'entity', entity: 'asm_2' } },
        ]);
    });

    it('only unlinks, never links to itself, where the entity merged into holds the link to the merged one', () => {
        const mirrors = {
            analyses: [{ local_id: 'an_1', mirror_of: 'an_2' }, { local_id: 'an_2' }],
        };
        const store = createReviewStore(
            makeBundle(mirrors, TEXT, {
                entities: entityRows(row('an_1', 'Analysis', 'analyses'), row('an_2', 'Analysis', 'analyses')),
                review,
            }),
            { now: () => 'now' }
        );
        mergeInto(store.getState(), 'an_2', 'an_1', []);
        expect(shapes(store)).toEqual([
            {
                type: 'unlink',
                target: { kind: 'relationship', entity: 'an_1', path: 'mirror_of', target_entity: 'an_2' },
            },
            { type: 'delete_entity', target: { kind: 'entity', entity: 'an_2' } },
        ]);
    });
});
