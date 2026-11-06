import type { Op } from '../contract/generated/review-ops';
import { ev, makeBundle } from '../test/bundles';
import { validateBundle } from '../test/schemas';
import { fixtureApi } from './fixtureApi';

function serve(files: Record<string, unknown>) {
    const fetch = vi.fn(async (url: string) =>
        url in files ? new Response(JSON.stringify(files[url])) : new Response('missing', { status: 404 })
    );
    vi.stubGlobal('fetch', fetch);
    return fetch;
}

describe('fixtureApi', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('lists the papers in fixtures/index.json under the app’s base', async () => {
        serve({ '/review/fixtures/index.json': [{ id: 'P1', label: 'A paper', total: 4 }] });
        expect(await fixtureApi('/review/').listPapers()).toEqual([
            {
                id: 'P1',
                base_study_id: 'P1',
                label: 'A paper',
                origin: 'upload',
                created_at: '1970-01-01T00:00:00.000Z',
                total: 4,
                reviews: [],
                assignees: [],
            },
        ]);
    });

    it('keeps assignments in memory, filters the list to the caller’s papers, and releases them', async () => {
        serve({
            '/review/fixtures/index.json': [
                { id: 'P1', label: 'A paper', total: 4 },
                { id: 'P2', label: 'Another', total: 2 },
            ],
        });
        const api = fixtureApi('/review/');
        await api.assign('P1', 'me');
        expect((await api.listPapers({ assigned: 'me' })).map((paper) => paper.id)).toEqual(['P1']);
        expect((await api.listPapers())[0].assignees).toEqual([{ user_id: 'me', name: 'Me' }]);
        await api.release('P1', 'me');
        expect(await api.listPapers({ assigned: 'me' })).toEqual([]);
    });

    it('loads a paper’s bundle and fails clearly when it is missing', async () => {
        const bundle = makeBundle({}, 'text');
        serve({ '/review/fixtures/P1.bundle.json': bundle });
        expect(await fixtureApi('/review/').getBundle('P1')).toEqual(bundle);
        await expect(fixtureApi('/review/').getBundle('P2')).rejects.toThrow('P2.bundle.json: 404');
    });

    it('loads a study_schema schema from fixtures/schemas', async () => {
        const schema = { $id: 'https://neurostuff.org/schemas/neuroimaging-paper-parse', $defs: {} };
        serve({ '/review/fixtures/schemas/coordinate-parse.schema.json': schema });
        expect(await fixtureApi('/review/').getSchema('coordinate-parse')).toEqual(schema);
    });
});

describe('fixtureApi reviews, kept in memory so the prototype saves offline', () => {
    afterEach(() => vi.unstubAllGlobals());

    const op = (id: string, start: number): Op => ({
        client_op_id: id,
        type: 'set_evidence',
        target: { kind: 'slot', entity: 'study', path: 'description' },
        evidence: { status: 'present', sets: [{ spans: [{ start_char: start, end_char: start + 4 }] }] },
    });

    async function started() {
        const bundle = makeBundle({ description: ev('A study') }, 'some text here');
        serve({ '/review/fixtures/P1.bundle.json': bundle });
        const api = fixtureApi('/review/');
        const review = await api.startReview('P1');
        return { api, review };
    }

    it('starts the review once and puts it in the bundle', async () => {
        const { api, review } = await started();
        expect(review).toMatchObject({ source_id: 'P1', state: 'in_progress', last_seq: 0 });
        expect(await api.startReview('P1')).toEqual(review);
        expect((await api.getBundle('P1')).review).toMatchObject({ id: review.id, last_seq: 0 });
    });

    it('refuses a structural op, which only the server applies, naming its op and leaving the review as it was', async () => {
        const { api, review } = await started();
        const create: Op = {
            client_op_id: 'op-cccccccc',
            type: 'create_entity',
            parent: 'study',
            list: 'groups',
            entity: { name: ev('Siblings') },
        };
        await expect(api.postOps(review.id, 0, [op('op-aaaaaaaa', 0), create])).rejects.toMatchObject({
            status: 422,
            body: {
                errors: [
                    {
                        message: 'structural edits need the server',
                        context: { op_index: 1, client_op_id: 'op-cccccccc' },
                    },
                ],
            },
        });
        expect((await api.getBundle('P1')).review).toMatchObject({ last_seq: 0 });
    });

    it('applies each batch and bumps last_seq, whatever the batch says it was made against', async () => {
        const { api, review } = await started();
        expect(await api.postOps(review.id, 0, [op('op-aaaaaaaa', 0)])).toMatchObject({
            last_seq: 1,
            ops: [{ seq: 1, op: { client_op_id: 'op-aaaaaaaa' } }],
        });
        expect(await api.postOps(review.id, 0, [op('op-bbbbbbbb', 5)])).toMatchObject({ last_seq: 2 });
        const bundle = await api.getBundle('P1');
        expect(bundle.ops).toHaveLength(2);
        expect(bundle.record).toMatchObject({ description: { evidence: { status: 'present' } } });
    });

    it('keeps the provenance each batch makes, in its answer and in the bundle', async () => {
        const { api, review } = await started();
        const result = await api.postOps(review.id, 0, [op('op-aaaaaaaa', 0)]);
        expect(result.provenance).toEqual({
            'slot:study:description': { state: 'edited', user_id: 'me', at: expect.any(String) },
        });
        expect(result.entities).toEqual((await api.getBundle('P1')).entities);
        expect((await api.getBundle('P1')).review?.provenance).toEqual(result.provenance);
    });

    it('refuses with a 422 naming the op one it cannot apply, as the server would', async () => {
        const { api, review } = await started();
        const create: Op = {
            client_op_id: 'op-cccccccc',
            type: 'create_entity',
            parent: 'study',
            list: 'groups',
            entity: {},
        };
        await expect(api.postOps(review.id, 0, [op('op-aaaaaaaa', 0), create])).rejects.toMatchObject({
            status: 422,
            body: { errors: [{ message: expect.any(String), context: { op_index: 1, client_op_id: 'op-cccccccc' } }] },
        });
        expect((await api.getBundle('P1')).review).toMatchObject({ last_seq: 0 });
    });

    it('keeps the bundle it serves valid against the bundle schema', async () => {
        const { api } = await started();
        await api.postOps((await api.getBundle('P1')).review!.id, 0, [op('op-aaaaaaaa', 0)]);
        validateBundle((await api.getBundle('P1')) as object);
        expect(validateBundle.errors ?? []).toEqual([]);
    });

    it('sets the state the review is in', async () => {
        const { api, review } = await started();
        expect(await api.setState(review.id, 'submitted')).toMatchObject({ state: 'submitted' });
        expect((await api.getBundle('P1')).review).toMatchObject({ state: 'submitted' });
        expect(await api.setState(review.id, 'in_progress')).toMatchObject({ state: 'in_progress' });
    });
});
