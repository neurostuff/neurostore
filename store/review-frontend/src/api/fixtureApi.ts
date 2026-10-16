import type { ReviewBundle, StoredOp } from '../contract/generated/review-bundle';
import type { Schema } from '../inspector/schema';
import { applyBatch, isLocalOp, OpRefused, type Documents } from '../model/applyOp';
import type { CoordinateParse } from '../model/coordinates';
import { codePointPaper } from '../model/offsets';
import type { Json } from '../model/paths';
import {
    type OpResult,
    type PaperSummary,
    refusedOp,
    type ReviewApi,
    type ReviewLifecycle,
    type ReviewSummary,
    withState,
} from './reviewApi';

async function getJson<T>(url: string): Promise<T> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${url}: ${response.status}`);
    return response.json() as Promise<T>;
}

const summary = (bundle: ReviewBundle): ReviewSummary => {
    const { id, user_id, state, set_aside, last_seq } = bundle.review!;
    return { id, source_id: bundle.source.id, user_id, state, ...(set_aside && { set_aside }), last_seq };
};

/**
 * Reviews of the fixture papers, kept in memory: each batch applies, with no conflict rules. Structural ops
 * (create, delete, link, unlink, coordinate, and any op on a keyed path) are refused: only the server applies them.
 */
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
        // Served from src/test/golden/schemas by the Vite middleware, the same files GOLDEN_SCHEMAS imports.
        getSchema: (name) => getJson<Schema>(url(`schemas/${name}.schema.json`)),
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
            const at = new Date().toISOString();
            const structural = ops.findIndex((op) => !isLocalOp(op));
            if (structural !== -1) {
                throw refusedOp(structural, ops[structural].client_op_id, 'structural edits need the server');
            }
            let documents: Documents;
            try {
                documents = applyBatch(
                    {
                        record: bundle.record as Json,
                        provenance: review.provenance,
                        annotations: review.annotations,
                    },
                    ops,
                    {
                        text: codePointPaper(bundle.text),
                        userId: review.user_id,
                        at,
                        coordinateParse: bundle.coordinate_parse as CoordinateParse,
                        entities: bundle.entities,
                    }
                );
            } catch (error) {
                if (error instanceof OpRefused) throw refusedOp(error.index, error.clientOpId, error.message);
                throw error;
            }
            const stored: StoredOp[] = ops.map((op, i) => ({
                seq: review.last_seq + i + 1,
                op,
                before: {},
                after: {},
                user_id: review.user_id,
                created_at: at,
            }));
            const { record, provenance, annotations } = documents;
            const last_seq = review.last_seq + stored.length;
            const next = {
                ...bundle,
                record,
                ops: [...bundle.ops, ...stored],
                review: { ...review, last_seq, provenance, annotations },
            };
            reviewed.set(bundle.source.id, next);
            // The stored ops carry no inverses, so fixture mode has no undo.
            return {
                ops: stored,
                last_seq,
                record,
                coordinate_revision: bundle.coordinate_revision,
                provenance,
                annotations,
                hidden: bundle.hidden,
                entities: bundle.entities,
            } satisfies OpResult;
        },
        async setState(reviewId, state: ReviewLifecycle, setAside) {
            const bundle = reviewOf(reviewId);
            const next = { ...bundle, review: withState(bundle.review!, state, setAside) };
            reviewed.set(bundle.source.id, next);
            return summary(next);
        },
    };
}
