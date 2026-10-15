import type { ReviewBundle } from '../contract/generated/review-bundle';
import { httpApi } from '../api/httpApi';
import { judgeableKeys, memoryBackend, type OpBatch } from './memoryBackend';
import { ApiError, type ReviewLifecycle } from '../api/reviewApi';
import { fakeFetch, json, type SentRequest } from './fakeFetch';
import { API_BASE } from './spec';

/** Answers a request ahead of the server: a Response, a thrown error, or undefined to let it through. */
export type Interceptor = (request: SentRequest) => Response | undefined | Promise<Response | undefined>;

const route = (request: SentRequest, pattern: RegExp, method: string) =>
    request.method === method ? request.path.slice(new URL(API_BASE).pathname.length).match(pattern) : null;

/** The /review API over a memory backend, with the real one's last_seq, replay and 409 semantics. */
export function fakeServer(bundles: ReviewBundle[], { userId = 'me' }: { userId?: string } = {}) {
    const byId = new Map(bundles.map((b) => [b.source.id, b]));
    const backend = memoryBackend(
        async (id) => {
            const bundle = byId.get(id);
            if (!bundle)
                throw new ApiError(404, { title: 'Not Found', detail: `Record ${id} not found in review source` });
            return bundle;
        },
        { userId }
    );
    const interceptors: Interceptor[] = [];

    async function answer(request: SentRequest): Promise<Response> {
        let m;
        if (route(request, /^\/review\/sources\/$/, 'GET')) {
            const params = new URL(request.url).searchParams;
            const page = Number(params.get('page') ?? 1);
            const size = Number(params.get('page_size') ?? bundles.length);
            return json({
                metadata: { total_count: bundles.length },
                results: bundles.slice((page - 1) * size, page * size).map(({ source, record, coordinate_parse }) => {
                    const judgeable = judgeableKeys(record, coordinate_parse);
                    return {
                        id: source.id,
                        base_study_id: source.base_study_id,
                        label: source.label,
                        origin: source.origin,
                        created_at: new Date().toISOString(),
                        total: judgeable.size,
                        reviews: backend.reviewSummaries(source.id, judgeable),
                    };
                }),
            });
        }
        if ((m = route(request, /^\/review\/sources\/([^/]+)\/bundle$/, 'GET')))
            return json(await backend.getBundle(decodeURIComponent(m[1])));
        if ((m = route(request, /^\/review\/sources\/([^/]+)\/review$/, 'PUT'))) {
            const { summary, created } = await backend.startReview(decodeURIComponent(m[1]));
            return json(summary, created ? 201 : 200);
        }
        if ((m = route(request, /^\/review\/reviews\/([^/]+)\/ops$/, 'POST')))
            return json(backend.postOps(decodeURIComponent(m[1]), request.body as OpBatch));
        if ((m = route(request, /^\/review\/reviews\/([^/]+)$/, 'PATCH')))
            return json(backend.setState(decodeURIComponent(m[1]), (request.body as { state: ReviewLifecycle }).state));
        return json({ status: 404, detail: `no route for ${request.method} ${request.path}` }, 404);
    }

    const { fetch, requests } = fakeFetch(async (request) => {
        const intercept = interceptors.shift();
        const early = intercept && (await intercept(request));
        if (early) return early;
        try {
            return await answer(request);
        } catch (error) {
            if (error instanceof ApiError)
                return json(
                    { type: 'about:blank', timestamp: new Date().toISOString(), request_id: 'request', ...error.body },
                    error.status
                );
            throw error;
        }
    });

    return {
        backend,
        requests,
        fetch,
        /** Queue one interceptor for the next request. */
        intercept: (interceptor: Interceptor) => interceptors.push(interceptor),
        api: () => httpApi(API_BASE, async () => 'test-token', fetch),
        invalid: () => requests.filter((r) => r.problems.length > 0),
    };
}

export type FakeServer = ReturnType<typeof fakeServer>;
