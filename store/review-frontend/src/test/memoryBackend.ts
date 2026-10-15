import type { ReviewBundle, StoredOp } from '../contract/generated/review-bundle';
import type { Op } from '../contract/generated/review-ops';
import { applyBatch, OpRefused, type Documents } from '../model/applyOp';
import type { CoordinateParse } from '../model/coordinates';
import { codePointPaper } from '../model/offsets';
import type { Json } from '../model/paths';
import { ApiError, type OpResult, refusedOp, type ReviewLifecycle, type ReviewSummary } from '../api/reviewApi';

interface Review extends ReviewSummary {
    created_at: string;
    updated_at: string | null;
    record: Json;
    provenance: NonNullable<ReviewBundle['review']>['provenance'];
    annotations: NonNullable<ReviewBundle['review']>['annotations'];
    ops: StoredOp[];
}

export interface OpBatch {
    expected_last_seq: number;
    ops: Op[];
}

const notFound = (what: string) =>
    new ApiError(404, { title: 'Not Found', detail: `Record ${what} not found in review` });
const conflict = (detail: string, extra: { last_seq?: number } = {}) =>
    new ApiError(409, { title: 'Conflict', detail, ...extra });

interface MemoryOptions {
    userId?: string;
    now?: () => string;
    userName?: (userId: string) => string;
}

/** One reviewer's reviews kept in memory, answering as the /review API does. */
export function memoryBackend(
    loadSource: (id: string) => Promise<ReviewBundle>,
    {
        userId = 'me',
        now = () => new Date().toISOString(),
        userName = (id: string) => `name of ${id}`,
    }: MemoryOptions = {}
) {
    const sources = new Map<string, ReviewBundle>();
    const reviews = new Map<string, Review>();
    let nextId = 0;

    async function source(id: string) {
        if (!sources.has(id)) sources.set(id, await loadSource(id));
        return sources.get(id)!;
    }

    const reviewOf = (sourceId: string) => [...reviews.values()].find((r) => r.source_id === sourceId);

    function review(id: string) {
        const found = reviews.get(id);
        if (!found) throw notFound(id);
        return found;
    }

    const summary = ({ id, source_id, user_id, state, last_seq, created_at, updated_at }: Review): ReviewSummary => ({
        id,
        source_id,
        user_id,
        state,
        last_seq,
        created_at,
        updated_at,
    });

    function result(r: Review, ops: StoredOp[]): OpResult {
        return {
            ops,
            last_seq: r.last_seq,
            record: r.record,
            coordinate_revision: null,
            provenance: r.provenance,
            annotations: r.annotations,
            hidden: sources.get(r.source_id)!.hidden,
            entities: sources.get(r.source_id)!.entities,
        };
    }

    return {
        async getBundle(sourceId: string): Promise<ReviewBundle> {
            const bundle = await source(sourceId);
            const r = reviewOf(sourceId);
            if (!r) return bundle;
            const { record, provenance, annotations, ops } = r;
            return {
                ...bundle,
                record,
                ops,
                review: { id: r.id, user_id: r.user_id, state: r.state, last_seq: r.last_seq, provenance, annotations },
            };
        },

        /** The reviews of a source as the source list shows them. */
        reviewSummaries(sourceId: string) {
            const r = reviewOf(sourceId);
            if (!r) return [];
            const states = Object.values(r.provenance as Record<string, { state: string }>).map((p) => p.state);
            return [
                {
                    user_id: r.user_id,
                    user_name: userName(r.user_id),
                    state: r.state,
                    last_seq: r.last_seq,
                    updated_at: null,
                    edited: states.filter((state) => state === 'edited').length,
                    verified: states.filter((state) => state === 'verified').length,
                },
            ];
        },

        async startReview(sourceId: string): Promise<{ summary: ReviewSummary; created: boolean }> {
            const existing = reviewOf(sourceId);
            if (existing) return { summary: summary(existing), created: false };
            const { record } = await source(sourceId);
            const id = `review-${++nextId}`;
            const r: Review = {
                id,
                source_id: sourceId,
                user_id: userId,
                state: 'in_progress',
                last_seq: 0,
                created_at: now(),
                updated_at: null,
                record: record as Json,
                provenance: {},
                annotations: {},
                ops: [],
            };
            reviews.set(id, r);
            return { summary: summary(r), created: true };
        },

        postOps(reviewId: string, batch: OpBatch): OpResult {
            const r = review(reviewId);
            const ids = new Set(batch.ops.map((op) => op.client_op_id));
            const stored = r.ops.filter((s) => ids.has(s.op.client_op_id));
            if (stored.length > 0 && stored.length === ids.size) return result(r, stored);
            if (stored.length > 0) throw conflict("Some of the batch's ops are stored and some are not.");
            if (r.state !== 'in_progress') throw conflict(`The review is ${r.state}; only in_progress takes ops.`);
            if (batch.expected_last_seq !== r.last_seq)
                throw conflict('The review has changed since the batch was made.', { last_seq: r.last_seq });
            const { text, coordinate_parse, entities } = sources.get(r.source_id)!;
            const at = now();
            let documents: Documents;
            try {
                documents = applyBatch(
                    { record: r.record, provenance: r.provenance, annotations: r.annotations },
                    batch.ops,
                    {
                        text: codePointPaper(text),
                        userId,
                        at,
                        coordinateParse: coordinate_parse as CoordinateParse,
                        entities,
                    }
                );
            } catch (error) {
                if (error instanceof OpRefused) throw refusedOp(error.index, error.clientOpId, error.message);
                throw error;
            }
            const applied = batch.ops.map((op, index): StoredOp => ({
                seq: r.last_seq + index + 1,
                op,
                before: {},
                after: {},
                user_id: userId,
                created_at: at,
            }));
            Object.assign(r, { ...documents, last_seq: r.last_seq + applied.length, ops: [...r.ops, ...applied] });
            return result(r, applied);
        },

        setState(reviewId: string, state: ReviewLifecycle): ReviewSummary {
            const r = review(reviewId);
            const allowed = { in_progress: 'submitted', submitted: 'in_progress' } as Record<string, string>;
            if (allowed[r.state] !== state) throw conflict(`A review cannot go from ${r.state} to ${state}.`);
            Object.assign(r, { state, updated_at: now() });
            return summary(r);
        },
    };
}

export type MemoryBackend = ReturnType<typeof memoryBackend>;
