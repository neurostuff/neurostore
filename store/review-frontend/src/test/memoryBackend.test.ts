import { entityRows, ev, makeBundle, row } from './bundles';
import { fakeServer } from './fakeServer';

describe('the memory backend', () => {
    it('keeps the provenance and annotations a batch leaves on the review', async () => {
        const bundle = makeBundle(
            {
                groups: [
                    { local_id: 'grp_a', name: ev('Patients') },
                    { local_id: 'grp_b', name: ev('Controls') },
                ],
            },
            'Twenty patients and eighteen controls.',
            { entities: entityRows(row('grp_a', 'Group', 'groups'), row('grp_b', 'Group', 'groups')) }
        );
        const server = fakeServer([bundle]);
        const { summary } = await server.backend.startReview('P1');
        server.backend.postOps(summary.id, {
            expected_last_seq: 0,
            ops: [
                {
                    client_op_id: 'v-1',
                    type: 'verdict',
                    target: { kind: 'entity', entity: 'grp_a' },
                    verdict: 'reject',
                    reason: 'wrong_entity',
                },
                {
                    client_op_id: 'e-1',
                    type: 'set_evidence',
                    target: { kind: 'entity', entity: 'grp_b' },
                    evidence: { status: 'present', sets: [{ spans: [{ start_char: 0, end_char: 6 }] }] },
                },
            ],
        });
        const saved = await server.backend.getBundle('P1');
        expect(saved.review?.provenance).toEqual({
            'entity:grp_a': { state: 'removed', user_id: 'me', at: expect.any(String) },
            'entity:grp_b': { state: 'edited', user_id: 'me', at: expect.any(String) },
        });
        expect(saved.review?.annotations).toEqual({
            'entity:grp_b': { status: 'present', sets: [{ spans: [{ start_char: 0, end_char: 6, text: 'Twenty' }] }] },
        });
    });
});
