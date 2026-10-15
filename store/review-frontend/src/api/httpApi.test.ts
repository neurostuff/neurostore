import type { Op } from '../contract/generated/review-ops';
import { makeBundle } from '../test/bundles';
import { fakeFetch, json, type Handler } from '../test/fakeFetch';
import { API_BASE } from '../test/spec';
import { httpApi } from './httpApi';
import { ApiError } from './reviewApi';

const summary = { id: 'R1', source_id: 'S1', user_id: 'me', state: 'in_progress', last_seq: 0 };

const op: Op = {
    client_op_id: 'op-00001',
    type: 'set_evidence',
    target: { kind: 'slot', entity: 'study', path: 'description' },
    evidence: { status: 'present', sets: [{ spans: [{ start_char: 0, end_char: 4 }] }] },
};

function serve(handler: Handler) {
    const server = fakeFetch(handler);
    const api = httpApi(API_BASE, async () => 'token-1', server.fetch);
    return { api, requests: server.requests };
}

describe('httpApi', () => {
    it('lists every page of /review/sources/', async () => {
        const sources = Array.from({ length: 150 }, (_, i) => ({
            id: `S${i}`,
            label: i === 3 ? null : `Paper ${i}`,
            total: 10 + i,
        }));
        const { api, requests } = serve(({ url }) => {
            const params = new URL(url).searchParams;
            const page = Number(params.get('page'));
            const size = Number(params.get('page_size'));
            return json({
                metadata: { total_count: sources.length },
                results: sources.slice((page - 1) * size, page * size),
            });
        });
        const papers = await api.listPapers();
        expect(papers).toHaveLength(150);
        expect(papers[0]).toEqual({ id: 'S0', label: 'Paper 0', total: 10 });
        expect(papers[3]).toEqual({ id: 'S3', label: 'S3', total: 13 });
        expect(requests.map((r) => r.path)).toEqual(['/api/review/sources/', '/api/review/sources/']);
        expect(requests.flatMap((r) => r.problems)).toEqual([]);
    });

    it('gets a bundle with the caller’s bearer token', async () => {
        const bundle = makeBundle({}, 'text');
        const { api, requests } = serve(() => json(bundle));
        expect(await api.getBundle('S 1')).toEqual(bundle);
        expect(requests).toMatchObject([{ method: 'GET', path: '/api/review/sources/S%201/bundle', problems: [] }]);
    });

    it('starts a review with PUT, taking 201 and 200 alike', async () => {
        const statuses = [201, 200];
        const { api, requests } = serve(() => json(summary, statuses.shift()));
        expect(await api.startReview('S1')).toEqual(summary);
        expect(await api.startReview('S1')).toEqual(summary);
        expect(requests).toMatchObject([
            { method: 'PUT', path: '/api/review/sources/S1/review', problems: [] },
            { method: 'PUT', path: '/api/review/sources/S1/review', problems: [] },
        ]);
    });

    it('posts ops with expected_last_seq, keepalive when asked', async () => {
        const result = { ops: [], last_seq: 4, record: {}, coordinate_revision: null, provenance: {}, annotations: {} };
        const { api, requests } = serve(() => json(result));
        expect(await api.postOps('R1', 3, [op])).toEqual(result);
        await api.postOps('R1', 3, [op], { keepalive: true });
        expect(requests).toMatchObject([
            { method: 'POST', path: '/api/review/reviews/R1/ops', keepalive: false, problems: [] },
            { keepalive: true, problems: [] },
        ]);
        expect(requests[0].body).toEqual({ expected_last_seq: 3, ops: [op] });
    });

    it('patches the review state', async () => {
        const { api, requests } = serve(() => json({ ...summary, state: 'submitted' }));
        expect(await api.setState('R1', 'submitted')).toMatchObject({ state: 'submitted' });
        expect(requests).toMatchObject([{ method: 'PATCH', path: '/api/review/reviews/R1', problems: [] }]);
        expect(requests[0].body).toEqual({ state: 'submitted' });
    });

    it('throws an ApiError carrying the ErrorResponse', async () => {
        const body = { status: 409, title: 'Conflict', detail: 'The review has changed', last_seq: 7 };
        const { api } = serve(() => json(body, 409));
        const error = await api.postOps('R1', 3, [op]).catch((e: unknown) => e);
        expect(error).toBeInstanceOf(ApiError);
        expect(error).toMatchObject({ status: 409, message: 'The review has changed', body: { last_seq: 7 } });
    });

    it('throws an ApiError with the status when the error body is not JSON', async () => {
        const { api } = serve(() => new Response('<html>', { status: 502 }));
        await expect(api.getBundle('S1')).rejects.toMatchObject({ status: 502 });
    });
});
