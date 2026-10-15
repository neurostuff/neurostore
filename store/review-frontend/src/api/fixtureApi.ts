import type { ReviewBundle, StoredOp } from '../contract/generated/review-bundle';
import { applyOp } from '../model/applyOp';
import type { Json } from '../model/paths';
import type { OpResult, PaperSummary, ReviewApi, ReviewLifecycle, ReviewSummary } from './reviewApi';

async function getJson<T>(url: string): Promise<T> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${url}: ${response.status}`);
    return response.json() as Promise<T>;
}

const summary = (bundle: ReviewBundle): ReviewSummary => {
    const { id, user_id, state, last_seq } = bundle.review!;
    return { id, source_id: bundle.source.id, user_id, state, last_seq };
};

/** Reviews of the fixture papers, kept in memory: each batch applies, with no conflict rules. */
export function fixtureApi(base: string): ReviewApi {
    const url = (file: string) => `${base}fixtures/${file}`;
    const sources = new Map<string, Promise<ReviewBundle>>();
    const reviewed = new Map<string, ReviewBundle>();

    const load = (id: string) => {
        if (!sources.has(id)) sources.set(id, getJson<ReviewBundle>(url(`${encodeURIComponent(id)}.bundle.json`)));
        return sources.get(id)!;
    };
    const reviewOf = (reviewId: string) => {
        const bundle = [...reviewed.values()].find((b) => b.review?.id === reviewId);
        if (!bundle) throw new Error(`no review ${reviewId}`);
        return bundle;
    };

    return {
        listPapers: () => getJson<PaperSummary[]>(url('index.json')),
        async getBundle(id) {
            return reviewed.get(id) ?? load(id);
        },
        async startReview(id) {
            if (!reviewed.has(id)) {
                const bundle = await load(id);
                reviewed.set(id, {
                    ...bundle,
                    review: {
                        id: `review-${id}`,
                        user_id: 'me',
                        state: 'in_progress',
                        last_seq: 0,
                        provenance: {},
                        annotations: {},
                    },
                    ops: [],
                });
            }
            return summary(reviewed.get(id)!);
        },
        async postOps(reviewId, _expectedLastSeq, ops) {
            const bundle = reviewOf(reviewId);
            const review = bundle.review!;
            let record = bundle.record as Json;
            const stored: StoredOp[] = ops.map((op, i) => {
                record = applyOp(record, op);
                return {
                    seq: review.last_seq + i + 1,
                    op,
                    before: {},
                    after: {},
                    user_id: review.user_id,
                    created_at: new Date().toISOString(),
                };
            });
            const last_seq = review.last_seq + stored.length;
            const next = { ...bundle, record, ops: [...bundle.ops, ...stored], review: { ...review, last_seq } };
            reviewed.set(bundle.source.id, next);
            return {
                ops: stored,
                last_seq,
                record,
                coordinate_revision: bundle.coordinate_revision,
                provenance: review.provenance,
                annotations: review.annotations,
                hidden: bundle.hidden,
            } satisfies OpResult;
        },
        async setState(reviewId, state: ReviewLifecycle) {
            const bundle = reviewOf(reviewId);
            const next = { ...bundle, review: { ...bundle.review!, state } };
            reviewed.set(bundle.source.id, next);
            return summary(next);
        },
    };
}
