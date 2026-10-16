import type { ReviewBundle } from '../contract/generated/review-bundle';
import type { Schema } from '../inspector/schema';
import {
    ApiError,
    type OpResult,
    type PaperSummary,
    type ReviewApi,
    type ReviewerProgress,
    type ReviewSummary,
    type SetAside,
} from './reviewApi';

const PAGE_SIZE = 100;

interface SourcePage {
    metadata: { total_count: number };
    results: { id: string; label: string | null; total: number; reviews: ReviewerProgress[] }[];
}

/** A set-aside's reason, and its note when it has one, as the state patch takes them. */
const patchOf = (setAside?: SetAside) =>
    setAside && { reason: setAside.reason, ...(setAside.note ? { note: setAside.note } : {}) };

export function httpApi(
    base: string,
    getToken: () => Promise<string | undefined>,
    fetchImpl: typeof fetch = fetch
): ReviewApi {
    async function request<T>(method: string, path: string, body?: unknown, keepalive = false): Promise<T> {
        const token = await getToken();
        if (!token) throw new Error('no access token');
        const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
        if (body !== undefined) headers['Content-Type'] = 'application/json';
        const response = await fetchImpl(`${base}${path}`, {
            method,
            headers,
            body: body === undefined ? undefined : JSON.stringify(body),
            keepalive,
        });
        const payload = await response.json().catch(() => undefined);
        if (!response.ok) throw new ApiError(response.status, payload);
        return payload as T;
    }

    const id = encodeURIComponent;

    return {
        listPapers: async () => {
            const papers: PaperSummary[] = [];
            for (let page = 1; ; page += 1) {
                const { metadata, results } = await request<SourcePage>(
                    'GET',
                    `/review/sources/?page=${page}&page_size=${PAGE_SIZE}`
                );
                papers.push(
                    ...results.map((s) => ({ id: s.id, label: s.label ?? s.id, total: s.total, reviews: s.reviews }))
                );
                if (results.length === 0 || papers.length >= metadata.total_count) return papers;
            }
        },
        getBundle: (sourceId) => request<ReviewBundle>('GET', `/review/sources/${id(sourceId)}/bundle`),
        startReview: (sourceId) => request<ReviewSummary>('PUT', `/review/sources/${id(sourceId)}/review`),
        postOps: (reviewId, expectedLastSeq, ops, options = {}) =>
            request<OpResult>(
                'POST',
                `/review/reviews/${id(reviewId)}/ops`,
                { expected_last_seq: expectedLastSeq, ops },
                options.keepalive
            ),
        setState: (reviewId, state, setAside) =>
            request<ReviewSummary>('PATCH', `/review/reviews/${id(reviewId)}`, { state, ...patchOf(setAside) }),
        getSchema: (name) => request<Schema>('GET', `/review/schemas/${id(name)}`),
    };
}
