import type { SetAside } from '../api/reviewApi';
import { entityRows, ev, makeBundle, row } from './bundles';
import type { Op } from '../contract/generated/review-ops';
import type { CoordinateAnalysis } from '../model/coordinates';
import { coordinateBundle, FACES, INSULA, PARSE, PRECUNEUS, RECORD } from './coordinates';
import { fakeServer } from './fakeServer';
import { coordinateOpErrors } from './schemas';

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

describe('the memory backend’s links, as the review core applies them', () => {
    const record = {
        analyses: [{ local_id: 'a_1', name: ev('First'), measure: 'mea_1', acquisitions: ['acq_1'] }],
        acquisitions: [
            { local_id: 'acq_1', name: ev('Scan A') },
            { local_id: 'acq_2', name: ev('Scan B') },
        ],
        measures: [
            { local_id: 'mea_1', name: ev('BOLD') },
            { local_id: 'mea_2', name: ev('CBF') },
        ],
        tasks: [{ local_id: 'task_1', name: ev('Stroop') }],
        model_estimations: [{ local_id: 'mdl_1', name: ev('GLM') }],
    };
    const entities = entityRows(
        row('a_1', 'Analysis', 'analyses'),
        row('acq_1', 'Acquisition', 'acquisitions'),
        row('acq_2', 'Acquisition', 'acquisitions'),
        row('mea_1', 'Measure', 'measures'),
        row('mea_2', 'Measure', 'measures'),
        row('task_1', 'Task', 'tasks'),
        row('mdl_1', 'ModelEstimation', 'model_estimations')
    );
    const rel = (path: string, target_entity: string) =>
        ({ kind: 'relationship', entity: 'a_1', path, target_entity }) as const;
    let n = 0;
    const op = (type: 'link' | 'unlink', path: string, target: string, extra: object = {}): Op =>
        ({ client_op_id: `link-op-${++n}`, type, target: rel(path, target), ...extra }) as Op;

    async function open() {
        const server = fakeServer([makeBundle(record, 'Some text.', { entities })]);
        const { summary } = await server.backend.startReview('P1');
        let seq = 0;
        const post = (...ops: Op[]) => {
            const result = server.backend.postOps(summary.id, { expected_last_seq: seq, ops });
            seq = result.last_seq;
            return result;
        };
        const analysis = () => (result: { record: unknown }) =>
            (result.record as { analyses: Record<string, unknown>[] }).analyses[0];
        return { post, analysis: analysis() };
    }
    const entry = (state: string) => ({ state, user_id: 'me', at: expect.any(String) });

    it('adds a link to a list: the link added, the slot edited, its before and after the lists, an unlink its inverse', async () => {
        const { post, analysis } = await open();
        const result = post(op('link', 'acquisitions', 'acq_2'));
        expect(analysis(result).acquisitions).toEqual(['acq_1', 'acq_2']);
        expect(result.provenance).toEqual({
            'slot:a_1:acquisitions': entry('edited'),
            'relationship:a_1:acquisitions:acq_2': entry('added'),
        });
        expect(result.ops[0]).toMatchObject({
            before: ['acq_1'],
            after: ['acq_1', 'acq_2'],
            inverse: [{ type: 'unlink', target: rel('acquisitions', 'acq_2') }],
        });
    });

    it('links through an absent slot as the shape the schema gives it: a string for a single one, a list for a list', async () => {
        const { post, analysis } = await open();
        const single = post(op('link', 'model_estimation', 'mdl_1'));
        expect(analysis(single).model_estimation).toBe('mdl_1');
        expect(single.ops[0]).toMatchObject({ before: null, after: 'mdl_1' });
        const listed = post(op('link', 'tasks', 'task_1'));
        expect(analysis(listed).tasks).toEqual(['task_1']);
    });

    it('replaces a single link, marking the old one removed; its inverse links the old one back', async () => {
        const { post, analysis } = await open();
        const result = post(op('link', 'measure', 'mea_2'));
        expect(analysis(result).measure).toBe('mea_2');
        expect(result.provenance).toMatchObject({
            'relationship:a_1:measure:mea_1': entry('removed'),
            'relationship:a_1:measure:mea_2': entry('added'),
        });
        expect(result.ops[0].inverse).toEqual([{ type: 'link', target: rel('measure', 'mea_1') }]);
    });

    it.each([
        ['a link it holds already', 'acquisitions', 'acq_1'],
        ['an entity of another class', 'acquisitions', 'task_1'],
    ])('refuses %s', async (_, path, target) => {
        const { post } = await open();
        expect(() => post(op('link', path, target))).toThrow(expect.objectContaining({ status: 422 }));
    });

    it('unlinks the last reference by removing the key, its inverse relinking it at its place', async () => {
        const { post, analysis } = await open();
        const result = post(op('unlink', 'acquisitions', 'acq_1'));
        expect(analysis(result)).not.toHaveProperty('acquisitions');
        expect(result.provenance).toMatchObject({ 'relationship:a_1:acquisitions:acq_1': entry('removed') });
        expect(result.ops[0]).toMatchObject({
            before: ['acq_1'],
            after: null,
            inverse: [{ type: 'link', target: rel('acquisitions', 'acq_1'), index: 0 }],
        });
        const back = post(op('link', 'acquisitions', 'acq_1', { index: 0 }));
        expect(analysis(back).acquisitions).toEqual(['acq_1']);
        expect(back.provenance).toMatchObject({ 'relationship:a_1:acquisitions:acq_1': entry('added') });
    });
});

describe('the memory backend’s coordinate ops', () => {
    const edit = (key: string, points: unknown[], id = 'c-1') => ({
        client_op_id: id,
        type: 'coordinate' as const,
        target: { kind: 'coordinate_analysis' as const, analysis_key: key },
        action: 'edit_points' as const,
        payload: { points } as never,
    });

    it('applies edit_points as the server does: a new key, the record following, and a restore as its inverse', async () => {
        const server = fakeServer([coordinateBundle()]);
        const { summary } = await server.backend.startReview('P1');
        const moved = [{ ...PRECUNEUS, coordinates: [4, -60, 42] }, INSULA];
        const result = server.backend.postOps(summary.id, { expected_last_seq: 0, ops: [edit(FACES.key, moved)] });
        const analyses = (result.coordinate_revision as { analyses: CoordinateAnalysis[] }).analyses;
        const edited = analyses[0];
        expect(edited).toMatchObject({ name: FACES.name, points: moved, derived_from: [FACES.key] });
        expect(edited.key).not.toBe(FACES.key);
        expect(analyses.slice(1)).toEqual(PARSE.analyses.slice(1));
        expect((result.record as typeof RECORD).analyses[0].source_table_analysis.value).toBe(edited.key);
        const [{ inverse }] = result.ops;
        expect(coordinateOpErrors((inverse ?? []).map((op, i) => ({ ...op, client_op_id: `undo-000${i}` })))).toEqual(
            []
        );
        const undone = server.backend.postOps(summary.id, {
            expected_last_seq: 1,
            ops: (inverse ?? []).map((op, i) => ({ ...op, client_op_id: `undo-000${i}` }) as Op),
        });
        expect((undone.coordinate_revision as { analyses: CoordinateAnalysis[] }).analyses).toEqual(PARSE.analyses);
        expect((undone.record as typeof RECORD).analyses[0].source_table_analysis.value).toBe(FACES.key);
        expect((await server.backend.getBundle('P1')).coordinate_revision).toEqual(undone.coordinate_revision);
    });
});
