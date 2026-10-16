import type { SetAside } from '../api/reviewApi';
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

    describe('the review states', () => {
        const open = async () => {
            const server = fakeServer([makeBundle({}, 'Some text.')]);
            const { summary } = await server.backend.startReview('P1');
            return { backend: server.backend, id: summary.id };
        };

        it('sets a review aside with its reason and note, and drops both on resuming', async () => {
            const { backend, id } = await open();
            expect(backend.setState(id, 'set_aside', 'duplicate', 'same as P2')).toMatchObject({
                state: 'set_aside',
                set_aside: { reason: 'duplicate', note: 'same as P2' },
            });
            expect(backend.setState(id, 'in_progress')).not.toHaveProperty('set_aside');
            expect(backend.setState(id, 'set_aside', 'duplicate').set_aside).toEqual({
                reason: 'duplicate',
                note: null,
            });
        });

        it.each([
            ['set_aside', undefined, undefined],
            ['set_aside', 'bored', undefined],
            ['set_aside', 'other', '  '],
            ['submitted', 'duplicate', undefined],
            ['submitted', undefined, 'why'],
        ] as const)('refuses %s with reason %s and note %s with a 422', async (state, reason, note) => {
            const { backend, id } = await open();
            expect(() => backend.setState(id, state, reason as SetAside['reason'] | undefined, note)).toThrow(
                expect.objectContaining({ status: 422 })
            );
        });

        it('refuses to set a submitted review aside and to resume one in progress, with a 409', async () => {
            const { backend, id } = await open();
            expect(() => backend.setState(id, 'in_progress')).toThrow(expect.objectContaining({ status: 409 }));
            backend.setState(id, 'submitted');
            expect(() => backend.setState(id, 'set_aside', 'duplicate')).toThrow(
                expect.objectContaining({ status: 409 })
            );
        });
    });
});
