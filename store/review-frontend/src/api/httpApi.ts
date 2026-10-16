import type { ReviewBundle } from '../contract/generated/review-bundle';
import type { Schema } from '../inspector/schema';
import {
    ApiError,
    type Assignee,
    type OpResult,
    type PaperFilter,
    type PaperSummary,
    type Me,
    type ReviewApi,
    type ReviewerProgress,
    type ReviewSummary,
    type SetAside,
} from './reviewApi';

const PAGE_SIZE = 100;

interface SourcePage {
    metadata: { total_count: number };
    results: {
        id: string;
        base_study_id: string;
        label: string | null;
        total: number;
        assignees: Assignee[];
        reviews: ReviewerProgress[];
    }[];
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
        listPapers: async (filter: PaperFilter = {}) => {
            const papers: PaperSummary[] = [];
            const assigned = filter.assigned ? `&assigned=${filter.assigned}` : '';
            for (let page = 1; ; page += 1) {
                const { metadata, results } = await request<SourcePage>(
                    'GET',
                    `/review/sources/?page=${page}&page_size=${PAGE_SIZE}${assigned}`
                );
                papers.push(
                    ...results.map((s) => ({
                        id: s.id,
                        base_study_id: s.base_study_id,
                        label: s.label ?? s.id,
                        total: s.total,
                        assignees: s.assignees,
                        reviews: s.reviews,
                    }))
                );
                if (results.length === 0 || papers.length >= metadata.total_count) return papers;
            }
        },
        assign: async (baseStudyId, userId) => {
            await request('PUT', `/review/base-studies/${id(baseStudyId)}/assignments/${id(userId)}`);
        },
        release: async (baseStudyId, userId) => {
            await request('DELETE', `/review/base-studies/${id(baseStudyId)}/assignments/${id(userId)}`);
        },
        getMe: () => request<Me>('GET', '/review/me'),
        listReviewers: async () => (await request<{ results: Assignee[] }>('GET', '/review/reviewers/')).results,
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
