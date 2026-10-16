import type { StoredOp } from '../contract/generated/review-bundle';
import { createReviewStores } from '../store/context';
import { entityRows, ev, makeBundle, notReported, row } from './bundles';

export const TEXT = 'x'.repeat(300);

export const record = {
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

export const entities = entityRows(
    row('grp_a', 'Group', 'groups'),
    row('grp_b', 'Group', 'groups'),
    row('a_hidden', 'Analysis', 'analyses')
);

export const storedOp: StoredOp = {
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

/** The stores of a paper with two groups and a hidden analysis, one verdict already stored. */
export function setup() {
    const bundle = makeBundle(record, TEXT, {
        entities,
        ops: [storedOp],
        hidden: { analyses: ['a_hidden'], entities: [] },
    });
    return createReviewStores(bundle);
}
