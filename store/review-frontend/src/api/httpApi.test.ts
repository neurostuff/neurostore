import type { Op } from '../contract/generated/review-ops';
import { makeBundle } from '../test/bundles';
import { fakeFetch, json, type Handler } from '../test/fakeFetch';
import { API_BASE, responseProblems } from '../test/spec';
import { httpApi } from './httpApi';
import { ApiError } from './reviewApi';

const summary = {
    id: 'R1',
    source_id: 'S1',
    user_id: 'me',
    state: 'in_progress',
    last_seq: 0,
    created_at: '2026-10-16T09:00:00+00:00',
    updated_at: null,
};

const op: Op = {
    client_op_id: 'op-00001',
    type: 'set_evidence',
    target: { kind: 'slot', entity: 'study', path: 'description' },
    evidence: { status: 'present', sets: [{ spans: [{ start_char: 0, end_char: 4 }] }] },
};

const nonConforming: string[] = [];

afterEach(() => {
    expect(nonConforming.splice(0)).toEqual([]);
});

function serve(handler: Handler) {
    const server = fakeFetch(async (request) => {
        const response = await handler(request);
        const text = await response.clone().text();
        if (text.startsWith('{') || text.startsWith('[')) {
            nonConforming.push(...responseProblems(request.method, request.url, response.status, JSON.parse(text)));
        }
        return response;
    });
    const api = httpApi(API_BASE, async () => 'token-1', server.fetch);
    return { api, requests: server.requests };
}

describe('httpApi', () => {
    it('lists every page of /review/sources/', async () => {
        const sources = Array.from({ length: 150 }, (_, i) => ({
            id: `S${i}`,
            base_study_id: `B${i}`,
            label: i === 3 ? null : `Paper ${i}`,
            origin: 'upload',
            created_at: '2026-10-16T09:00:00+00:00',
            total: 10 + i,
            reviews: [],
            assignees: [],
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
        expect(papers).toEqual(sources);
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
        const result = {
            ops: [],
            last_seq: 4,
            record: {},
            coordinate_revision: null,
            provenance: {},
            annotations: {},
            hidden: {},
        };
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

    it('gets a study_schema schema by name', async () => {
        const schema = { $id: 'https://neurostuff.org/schemas/neuroimaging-study-extraction', $defs: {} };
        const { api, requests } = serve(() => json(schema));
        expect(await api.getSchema('extraction-record')).toEqual(schema);
        expect(requests).toMatchObject([
            { method: 'GET', path: '/api/review/schemas/extraction-record', problems: [] },
        ]);
    });

    it('throws an ApiError carrying the ErrorResponse', async () => {
        const body = {
            status: 409,
            title: 'Conflict',
            detail: 'The review has changed',
            last_seq: 7,
            timestamp: '2026-10-16T09:00:00+00:00',
            request_id: 'req-1',
        };
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

describe('assignments and reviewers', () => {
    it('lists the papers assigned to the caller, with the base study, assignees and each reviewer’s last edit', async () => {
        const { api, requests } = serve(() =>
            json({
                metadata: { total_count: 1 },
                results: [
                    {
                        id: 'S1',
                        base_study_id: 'B1',
                        label: 'Paper',
                        origin: 'upload',
                        created_at: '2026-10-16T09:00:00+00:00',
                        total: 4,
                        assignees: [{ user_id: 'me', name: 'Me' }],
                        reviews: [
                            {
                                user_id: 'me',
                                user_name: 'Me',
                                state: 'in_progress',
                                last_seq: 2,
                                updated_at: '2026-10-16T10:00:00+00:00',
                                edited: 1,
                                verified: 0,
                                reviewed: 1,
                                op_count: 2,
                                last_edit_at: '2026-10-16T10:00:00+00:00',
                            },
                        ],
                    },
                ],
            })
        );
        const [paper] = await api.listPapers({ assigned: 'me' });
        expect(requests[0].url).toContain('assigned=me');
        expect(paper.base_study_id).toBe('B1');
        expect(paper.assignees).toEqual([{ user_id: 'me', name: 'Me' }]);
        expect(paper.reviews?.[0]).toMatchObject({ op_count: 2, last_edit_at: '2026-10-16T10:00:00+00:00' });
    });

    it('assigns a paper to a reviewer and releases it, each on its own route', async () => {
        const { api, requests } = serve(({ method }) =>
            method === 'DELETE'
                ? new Response(null, { status: 204 })
                : json({ base_study_id: 'B 1', user_id: 'me', name: 'Me', assigned_by_id: 'me' }, 201)
        );
        await api.assign('B 1', 'me');
        await api.release('B 1', 'me');
        expect(requests.map((r) => [r.method, r.path])).toEqual([
            ['PUT', '/api/review/base-studies/B%201/assignments/me'],
            ['DELETE', '/api/review/base-studies/B%201/assignments/me'],
        ]);
        expect(requests.flatMap((r) => r.problems)).toEqual([]);
    });

    it('lists the admin-reviewers', async () => {
        const { api, requests } = serve(() => json({ results: [{ user_id: 'ana', name: 'Ana' }] }));
        expect(await api.listReviewers()).toEqual([{ user_id: 'ana', name: 'Ana' }]);
        expect(requests[0].path).toBe('/api/review/reviewers/');
    });

    it('says who the caller is, and whether they lead', async () => {
        const { api, requests } = serve(() => json({ user_id: 'me', name: 'Me', lead: true }));
        expect(await api.getMe()).toEqual({ user_id: 'me', name: 'Me', lead: true });
        expect(requests[0].path).toBe('/api/review/me');
    });
});
