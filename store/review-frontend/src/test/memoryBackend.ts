import type { Provenance, ReviewBundle, StoredOp } from '../contract/generated/review-bundle';
import type { CreateEntityOp, Evidence, Op } from '../contract/generated/review-ops';
import { applyBatch, OpRefused, type ApplyContext, type Documents } from '../model/applyOp';
import type { CoordinateParse } from '../model/coordinates';
import { codePointPaper } from '../model/offsets';
import { entityPath, getIn, readPath, setIn, writePath, type Json } from '../model/paths';
import { listClassesAt, pick, type Schema } from '../model/schema';
import { referenceSlotOf } from '../model/schema';
import { slotKey, targetKey } from '../model/targetKey';
import type { InverseOp } from '../store/undoSteps';
import {
    ApiError,
    type OpResult,
    refusedOp,
    type ReviewLifecycle,
    type ReviewSummary,
    type SetAside,
    withState,
} from '../api/reviewApi';
import { SET_ASIDE_REASONS } from '../review/asideReasons';
import { walkClasses } from './golden/schemaWalk';
import { applyCoordinate, indexedAnalyses } from './memoryCoordinates';
import { CREATED_ID, EXTRACTION_SCHEMA, withCreated } from './recordProblems';

interface Review extends ReviewSummary {
    created_at: string;
    updated_at: string | null;
    record: Json;
    provenance: NonNullable<ReviewBundle['review']>['provenance'];
    annotations: NonNullable<ReviewBundle['review']>['annotations'];
    ops: StoredOp[];
    /** The inverse of each stored op that has one, by client_op_id; the op result carries it, the bundle does not. */
    inverses: Record<string, InverseOp[]>;
    /** The coordinate revision, null until a coordinate op changes the parse. */
    revision: CoordinateParse | null;
}

/** The state changes a review's owner may make, as the backend's OWNER_TRANSITIONS. */
const OWNER_TRANSITIONS: [ReviewLifecycle, ReviewLifecycle][] = [
    ['in_progress', 'submitted'],
    ['submitted', 'in_progress'],
    ['in_progress', 'set_aside'],
    ['set_aside', 'in_progress'],
];

const unprocessable = (detail: string) => new ApiError(422, { title: 'Unprocessable Entity', detail });

const REVIEWED_STATES = new Set(['verified', 'edited', 'added', 'removed']);

/** The provenance keys of the targets a reviewer can judge in a source, as the backend's _judgeable gives them. */
export function judgeableKeys(record: unknown, parse: unknown): Set<string> {
    const values = walkClasses(record as Json).wrappers.map((wrapper) => `slot:${wrapper.entity}:${wrapper.path}`);
    const analyses = ((parse as { analyses?: { key: string }[] } | null)?.analyses ?? []).map(
        (analysis) => `coordinate_analysis:${analysis.key}`
    );
    return new Set([...values, ...analyses]);
}

type Wrapper = { evidence?: Evidence } & Record<string, unknown>;

/** `evidence` as a set_evidence op writes it: spans by offset only. */
const opEvidence = (evidence: Evidence | undefined): Evidence =>
    evidence
        ? {
              ...evidence,
              ...(evidence.sets && {
                  sets: evidence.sets.map((set) => ({
                      ...set,
                      spans: set.spans.map(({ start_char, end_char }) => ({ start_char, end_char })),
                  })) as Evidence['sets'],
              }),
          }
        : { status: 'not_applicable' };

const wrapperAt = (record: Json, entity: string, path: string) =>
    readPath(getIn(record, entityPath(record, entity) ?? []), path) as Wrapper | undefined;

/** The ops that undo a set_value or set_evidence `op` applied to `before`, as the backend's ops.inverse gives them. */
export function inverseOf(op: Op, before: Documents, after: Documents): InverseOp[] | undefined {
    if (op.type === 'set_value') {
        const was = wrapperAt(before.record, op.target.entity, op.target.path) ?? {};
        const now = wrapperAt(after.record, op.target.entity, op.target.path) ?? {};
        const value = {
            extraction_status: was.extraction_status ?? 'not_reported',
            ...('value' in was && { value: was.value }),
            ...(was.value_source != null && { value_source: was.value_source }),
            ...(was.unreported_reason != null && { unreported_reason: was.unreported_reason }),
        };
        const undo = [{ type: 'set_value', target: op.target, value } as InverseOp];
        if (was.evidence && JSON.stringify(was.evidence) !== JSON.stringify(now.evidence))
            undo.push({ type: 'set_evidence', target: op.target, evidence: opEvidence(was.evidence) });
        return undo;
    }
    if (op.type === 'set_evidence') {
        const was =
            op.target.kind === 'slot'
                ? wrapperAt(before.record, op.target.entity, op.target.path)?.evidence
                : (before.annotations[targetKey(op.target)] as Evidence | undefined);
        return [{ type: 'set_evidence', target: op.target, evidence: opEvidence(was) }];
    }
    if (op.type === 'verdict') {
        const was = before.provenance[targetKey(op.target)];
        return [
            was
                ? { type: 'verdict', target: op.target, verdict: 'restore', previous: was }
                : { type: 'verdict', target: op.target, verdict: 'clear' },
        ];
    }
    return undefined;
}

type LinkOp = Extract<Op, { type: 'link' | 'unlink' }>;

const mark = (
    provenance: Documents['provenance'],
    key: string,
    state: Provenance['state'],
    by: { userId: string; at: string }
): Documents['provenance'] => ({
    ...provenance,
    [key]: { state, user_id: by.userId, at: by.at },
});

/**
 * The documents after the link or unlink `op`, its logged before and after and its inverse, as the review core's
 * apply_link and apply_unlink give them: a link of the slot's class it does not hold yet, set on a single slot (the
 * replaced link marked removed) or added to a list; an unlink dropping the slot once it holds none. The link is
 * marked added or removed and its slot edited.
 */
function linked(documents: Documents, op: LinkOp, rows: EntityRow[], by: { userId: string; at: string }) {
    const { entity, path, target_entity: id } = op.target;
    const rowOf = (local: string) => rows.find((r) => r.local_id === local);
    const row = rowOf(entity);
    const slot = row && referenceSlotOf(row, path);
    if (!slot) throw new Error(`${JSON.stringify(path)} on ${JSON.stringify(entity)} is not a reference slot`);
    const target = rowOf(id);
    if (!target) throw new Error(`no entity ${JSON.stringify(id)}`);
    const at = entityPath(documents.record, entity)!;
    const item = getIn(documents.record, at) as Json;
    const held = readPath(item, path);
    const ids = (slot.multivalued ? ((held as string[] | undefined) ?? []) : held == null ? [] : [held]) as string[];
    const key = (to: string) => targetKey({ ...op.target, target_entity: to });
    let provenance = documents.provenance;
    let next: unknown;
    if (op.type === 'link') {
        if (![target.entity_class, target.schema_class].includes(slot.target))
            throw new Error(
                `${JSON.stringify(id)} is a ${target.schema_class}; ${slot.slot} on ${slot.class} references ${slot.target}`
            );
        if (ids.includes(id))
            throw new Error(`${JSON.stringify(entity)} ${path} already references ${JSON.stringify(id)}`);
        const index = (op as { index?: number }).index ?? ids.length;
        next = slot.multivalued ? [...ids.slice(0, index), id, ...ids.slice(index)] : id;
        if (!slot.multivalued && held != null) provenance = mark(provenance, key(held as string), 'removed', by);
    } else {
        if (!ids.includes(id))
            throw new Error(`${JSON.stringify(entity)} ${path} does not reference ${JSON.stringify(id)}`);
        const remaining = ids.filter((other) => other !== id);
        next = remaining.length ? remaining : undefined;
    }
    provenance = mark(provenance, slotKey(entity, path), 'edited', by);
    provenance = mark(provenance, key(id), op.type === 'link' ? 'added' : 'removed', by);
    const written = next === undefined ? withoutPath(item, path) : writePath(item, path, next);
    const before = held ?? null;
    const undo: InverseOp =
        op.type === 'unlink'
            ? { type: 'link', target: op.target, ...(Array.isArray(held) && { index: held.indexOf(id) }) }
            : Array.isArray(held) || held == null
              ? { type: 'unlink', target: op.target }
              : { type: 'link', target: { ...op.target, target_entity: held as string } };
    return {
        documents: { ...documents, record: setIn(documents.record, at, written), provenance },
        step: { undo: [undo], before: structuredClone(before), after: structuredClone(next ?? null) },
    };
}

/** `item` without the attribute at the top-level or nested field `path`. */
function withoutPath(item: Json, path: string): Json {
    const dot = path.lastIndexOf('.');
    const owner = (dot === -1 ? item : readPath(item, path.slice(0, dot))) as Json;
    const rest = Object.fromEntries(Object.entries(owner).filter(([name]) => name !== path.slice(dot + 1)));
    return dot === -1 ? rest : writePath(item, path.slice(0, dot), rest);
}

/** What `op` replaces or writes in `documents`, as the backend logs it; null where nothing is there. */
function loggedOf(op: Op, documents: Documents): unknown {
    if (op.type === 'set_value') return wrapperAt(documents.record, op.target.entity, op.target.path) ?? null;
    if (op.type === 'set_evidence')
        return (
            (op.target.kind === 'slot'
                ? wrapperAt(documents.record, op.target.entity, op.target.path)?.evidence
                : documents.annotations[targetKey(op.target)]) ?? null
        );
    if (op.type === 'verdict') {
        const entry = documents.provenance[targetKey(op.target)] ?? null;
        return op.target.kind === 'coordinate_analysis' ? { provenance: entry, reasons: {} } : entry;
    }
    return {};
}

/** Each op's inverse and logged before and after, applying `ops` one at a time to `documents`. */
function stepsOf(documents: Documents, ops: Op[], paper: Omit<ApplyContext, 'provenance' | 'annotations'>) {
    let before = documents;
    return ops.map((op) => {
        const after = applyBatch(before, [op], paper);
        const step = {
            undo: inverseOf(op, before, after),
            before: loggedOf(op, before) as StoredOp['before'],
            after: (loggedOf(op, after) ?? (op.type === 'set_evidence' ? op.evidence : null)) as StoredOp['after'],
        };
        before = after;
        return step;
    });
}

export interface OpBatch {
    expected_last_seq: number;
    ops: Op[];
}

const notFound = (what: string) =>
    new ApiError(404, { title: 'Not Found', detail: `Record ${what} not found in review` });
const conflict = (detail: string, extra: { last_seq?: number } = {}) =>
    new ApiError(409, { title: 'Conflict', detail, ...extra });

export interface MemoryOptions {
    userId?: string;
    now?: () => string;
    userName?: (userId: string) => string;
    /**
     * The problems a create_entity op brings into the record, as the server words them. With it, create_entity ops,
     * otherwise the server's alone (ADR 0002), are applied here: one with problems is refused with them, the rest
     * placed at the end of their list.
     */
    createdProblems?: (record: Json, op: CreateEntityOp) => string[];
}

const refusedWith = (index: number, clientOpId: string, problems: string[]) =>
    new ApiError(422, {
        title: 'Unprocessable Entity',
        detail: `op ${index} leaves an invalid document`,
        errors: problems.map((message) => ({
            field: `ops/${index}`,
            code: 'REJECTED',
            message,
            context: { op_index: index, client_op_id: clientOpId },
        })),
    });

type EntityRow = ReviewBundle['entities'][number];

/** The entity row of `op`'s new entity: its class picked from those its list holds, named as a sibling's is. */
function createdRow(record: Json, entities: EntityRow[], op: CreateEntityOp): EntityRow {
    const root = EXTRACTION_SCHEMA as Schema;
    const parent = entities.find((e) => e.local_id === op.parent);
    const parentItem = getIn(record, entityPath(record, op.parent) ?? []);
    const names = listClassesAt(root, parent?.schema_class ?? 'Study', op.list, parentItem);
    const schemaClass = pick(root, names, op.entity) ?? names[0];
    const sibling = entities.find((e) => e.parent === op.parent && e.list_path === op.list);
    return {
        local_id: ((op.entity as Json).local_id as string | undefined) ?? CREATED_ID,
        entity_class: sibling?.entity_class ?? schemaClass,
        schema_class: schemaClass,
        parent: op.parent,
        list_path: op.list,
    };
}

/** One reviewer's reviews kept in memory, answering as the /review API does. */
export function memoryBackend(
    loadSource: (id: string) => Promise<ReviewBundle>,
    {
        userId = 'me',
        now = () => new Date().toISOString(),
        userName = (id: string) => `name of ${id}`,
        createdProblems,
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

    const summary = ({
        id,
        source_id,
        user_id,
        state,
        set_aside,
        last_seq,
        created_at,
        updated_at,
    }: Review): ReviewSummary => ({
        id,
        source_id,
        user_id,
        state,
        ...(set_aside && { set_aside }),
        last_seq,
        created_at,
        updated_at,
    });

    function result(r: Review, ops: StoredOp[]): OpResult {
        return {
            ops: ops.map((stored) => {
                const inverse = r.inverses[stored.op.client_op_id];
                return inverse ? { ...stored, inverse } : stored;
            }),
            last_seq: r.last_seq,
            record: r.record,
            coordinate_revision: r.revision,
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
            const last = ops.at(-1);
            return {
                ...bundle,
                record,
                coordinate_revision: r.revision,
                ops,
                reviewers: [
                    {
                        user_id: r.user_id,
                        name: userName(r.user_id),
                        state: r.state,
                        op_count: ops.length,
                        last_edit_at: last?.created_at ?? null,
                    },
                ],
                review: {
                    id: r.id,
                    user_id: r.user_id,
                    state: r.state,
                    ...(r.set_aside && { set_aside: r.set_aside }),
                    last_seq: r.last_seq,
                    provenance,
                    annotations,
                },
            };
        },

        /** The reviews of a source as the source list shows them. */
        reviewSummaries(sourceId: string, judgeable: Set<string>) {
            const r = reviewOf(sourceId);
            if (!r) return [];
            const provenance = r.provenance as Record<string, { state: string }>;
            const states = Object.values(provenance).map((p) => p.state);
            return [
                {
                    user_id: r.user_id,
                    user_name: userName(r.user_id),
                    state: r.state,
                    ...(r.set_aside && { set_aside: r.set_aside }),
                    last_seq: r.last_seq,
                    updated_at: null,
                    op_count: r.ops.length,
                    last_edit_at: r.ops.at(-1)?.created_at ?? null,
                    edited: states.filter((state) => state === 'edited').length,
                    verified: states.filter((state) => state === 'verified').length,
                    reviewed: [...judgeable].filter((key) => REVIEWED_STATES.has(provenance[key]?.state)).length,
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
                inverses: {},
                revision: null,
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
            const before: Documents = { record: r.record, provenance: r.provenance, annotations: r.annotations };
            const paper = {
                text: codePointPaper(text),
                userId,
                at,
                coordinateParse: coordinate_parse as CoordinateParse,
                entities,
            };
            const parse = coordinate_parse as CoordinateParse;
            let documents = before;
            let revision = r.revision;
            const steps: ReturnType<typeof stepsOf> = [];
            const created: EntityRow[] = [];
            for (const [index, op] of batch.ops.entries()) {
                if (op.type === 'create_entity' && createdProblems) {
                    const problems = createdProblems(documents.record, op);
                    if (problems.length) throw refusedWith(index, op.client_op_id, problems);
                    created.push(createdRow(documents.record, [...entities, ...created], op));
                    documents = { ...documents, record: withCreated(documents.record, op) };
                    steps.push({ undo: undefined, before: {}, after: {} });
                    continue;
                }
                try {
                    if (op.type === 'link' || op.type === 'unlink') {
                        const done = linked(documents, op, [...entities, ...created], { userId, at });
                        documents = done.documents;
                        steps.push(done.step as (typeof steps)[number]);
                    } else if (op.type === 'coordinate') {
                        const was = (revision ?? parse).analyses ?? [];
                        const step = applyCoordinate(revision ?? parse, documents.record, op, parse);
                        revision = { ...(revision ?? parse), analyses: step.analyses };
                        documents = { ...documents, record: step.record };
                        steps.push({
                            undo: step.undo,
                            before: { analyses: indexedAnalyses(was, step.analyses) },
                            after: { analyses: indexedAnalyses(step.analyses, was) },
                        });
                    } else {
                        const at = { ...paper, coordinateRevision: revision };
                        steps.push(...stepsOf(documents, [op], at));
                        documents = applyBatch(documents, [op], at);
                    }
                } catch (error) {
                    if (error instanceof OpRefused) throw refusedOp(index, error.clientOpId, error.message);
                    throw refusedOp(index, op.client_op_id, (error as Error).message);
                }
            }
            const applied = batch.ops.map((op, index): StoredOp => ({
                seq: r.last_seq + index + 1,
                op,
                before: steps[index].before,
                after: steps[index].after,
                user_id: userId,
                created_at: at,
            }));
            batch.ops.forEach((op, index) => {
                const undo = steps[index].undo;
                if (undo) r.inverses[op.client_op_id] = undo;
            });
            if (created.length)
                sources.set(r.source_id, { ...sources.get(r.source_id)!, entities: [...entities, ...created] });
            Object.assign(r, {
                ...documents,
                revision,
                last_seq: r.last_seq + applied.length,
                ops: [...r.ops, ...applied],
            });
            return result(r, applied);
        },

        setState(reviewId: string, state: ReviewLifecycle, reason?: SetAside['reason'], note?: string): ReviewSummary {
            const r = review(reviewId);
            if (!OWNER_TRANSITIONS.some(([from, to]) => from === r.state && to === state))
                throw conflict(`A review cannot go from ${r.state} to ${state}.`);
            if (state !== 'set_aside') {
                if (reason !== undefined || note !== undefined)
                    throw unprocessable(`Only set_aside takes a reason or a note, not ${state}.`);
            } else if (reason === undefined || !Object.keys(SET_ASIDE_REASONS).includes(reason)) {
                throw unprocessable('A review is set aside with a reason.');
            } else if (reason === 'other' && !note?.trim()) {
                throw unprocessable('A review set aside for another reason needs a note.');
            }
            const next = withState({ ...r, updated_at: now() }, state, reason && { reason, note: note ?? null });
            reviews.set(r.id, next);
            return summary(next);
        },
    };
}

export type MemoryBackend = ReturnType<typeof memoryBackend>;
