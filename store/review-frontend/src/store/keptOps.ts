import type { ReviewBundle } from '../contract/generated/review-bundle';
import type { Evidence, Op, Span } from '../contract/generated/review-ops';
import { applyBatch, isLocalOp, type Documents, type Paper } from '../model/applyOp';
import type { CoordinateParse } from '../model/coordinates';
import { isCoordinate } from '../model/analysisFollow';
import { utf16Paper } from '../model/offsets';
import { entityPath, getIn, readPath, type Json } from '../model/paths';
import { targetKey } from '../model/targetKey';
import type { Blocked, EvidenceIntent, KeptOps, Notice, Refusal } from './sessionStore';

export const KEPT_REFUSED = 'edits kept on this device no longer apply';

type EvidenceSet = NonNullable<Evidence['sets']>[number];

const spanKey = (s: Span) => `${s.start_char}:${s.end_char}`;

function withoutText(set: EvidenceSet): EvidenceSet {
    return {
        ...set,
        spans: set.spans.map(({ start_char, end_char }) => ({ start_char, end_char })) as EvidenceSet['spans'],
    };
}

function inReadingOrder(spans: Span[]): EvidenceSet['spans'] {
    const unique = [...new Map(spans.map((s) => [spanKey(s), s])).values()];
    return unique.sort((a, b) => a.start_char - b.start_char || a.end_char - b.end_char) as EvidenceSet['spans'];
}

function withSpan(evidence: Evidence | undefined, span: Span, setIndex: number | 'new'): Evidence {
    const sets = (evidence?.sets ?? []).map(withoutText);
    if (setIndex === 'new' || setIndex >= sets.length) {
        return { ...evidence, status: 'present', sets: [...sets, { spans: [span] }] };
    }
    return {
        ...evidence,
        status: 'present',
        sets: sets.map((set, i) => (i === setIndex ? { ...set, spans: inReadingOrder([...set.spans, span]) } : set)),
    };
}

/** The index of the set of `evidence` holding `span`; -1 when none does. */
export const setHolding = (evidence: Evidence | undefined, span: Span): number =>
    (evidence?.sets ?? []).findIndex((set) => set.spans.some((s) => spanKey(s) === spanKey(span)));

/** The evidence with the span `from` replaced by `to`, or left out when `to` is null; null when it has no span `from`. */
function replacingSpan(evidence: Evidence | undefined, from: Span, to: Span | null): Evidence | null {
    const { sets: given = [], ...rest } = evidence ?? { status: 'not_found' };
    const sets = given.map(withoutText);
    const at = setHolding(evidence, from);
    if (at === -1) return null;
    const kept = sets[at].spans.filter((s) => spanKey(s) !== spanKey(from));
    const spans = to ? [...kept, to] : kept;
    const next = sets.flatMap((set, i) =>
        i !== at ? [set] : spans.length ? [{ ...set, spans: inReadingOrder(spans) }] : []
    );
    return next.length ? { ...rest, status: 'present', sets: next } : { ...rest, status: 'not_found' };
}

export const SPAN_GONE = 'the evidence span this edit moves or removes is no longer there';

/** The evidence `intent` makes of a slot's `evidence`, or why it no longer applies. */
export function evidenceFor(
    evidence: Evidence | undefined,
    intent: EvidenceIntent
): { evidence: Evidence } | { refused: string } {
    if (intent.kind === 'add_span') return { evidence: withSpan(evidence, intent.span, intent.set_index) };
    const replaced = replacingSpan(evidence, intent.from, intent.span);
    return replaced ? { evidence: replaced } : { refused: SPAN_GONE };
}

/** The set_evidence op an intent makes on top of `record`; other ops pass through. */
function carried(record: Json, op: Op, intent: EvidenceIntent | undefined): Op {
    if (!intent || op.type !== 'set_evidence' || op.target.kind !== 'slot') return op;
    const item = getIn(record, entityPath(record, op.target.entity) ?? []);
    const wrapper = readPath(item, op.target.path) as { evidence?: Evidence } | undefined;
    const intended = evidenceFor(wrapper?.evidence, intent);
    if ('refused' in intended) throw new Error(intended.refused);
    return { ...op, evidence: intended.evidence };
}

export const carrying = (intents: Record<string, EvidenceIntent>) => (record: Json, op: Op) =>
    carried(record, op, intents[op.client_op_id]);

/** The entries of `byOp` for the ops `ids` names. */
export const only = <T>(byOp: Record<string, T>, ids: Set<string>) =>
    Object.fromEntries(Object.entries(byOp).filter(([id]) => ids.has(id)));

export const slotLabel = (op: Op) => {
    if (!('target' in op)) return op.type;
    return op.target.kind === 'slot' ? `${op.target.entity} ${op.target.path}` : targetKey(op.target);
};

export const documentsOf = (bundle: ReviewBundle): Documents => ({
    record: bundle.record as Json,
    provenance: bundle.review?.provenance ?? {},
    annotations: bundle.review?.annotations ?? {},
});

const paperOf = (bundle: ReviewBundle, at: string): Paper => ({
    text: utf16Paper(bundle.text),
    userId: bundle.review?.user_id ?? '',
    at,
    coordinateParse: bundle.coordinate_parse as CoordinateParse,
    coordinateRevision: bundle.coordinate_revision as CoordinateParse | null,
    entities: bundle.entities,
});

/**
 * Whether `op` waits for the server: it is one the server applies, or one is pending before it that is not a
 * coordinate op. The ops behind a coordinate op are applied again on the record its result brings.
 */
export const waits = (before: Op[], op: Op) => !isLocalOp(op) || before.some((p) => !isLocalOp(p) && !isCoordinate(p));

/**
 * The ops kept pending, in order, with the documents after the ones applied: an op that waits is kept unapplied,
 * and one the core or `carry` refuses is dropped with a notice of `kind` and listed in `refused`. `carry` may rewrite an op
 * before it is applied.
 */
export function replay(
    bundle: ReviewBundle,
    base: Documents,
    ops: Op[],
    at: string,
    kind: Notice['kind'],
    carry: (record: Json, op: Op) => Op = (_, op) => op
) {
    let documents = base;
    const pending: Op[] = [];
    const notices: Notice[] = [];
    const refused: Refusal[] = [];
    for (const op of ops) {
        if (waits(pending, op)) {
            pending.push(op);
            continue;
        }
        try {
            const sent = carry(documents.record, op);
            documents = applyBatch(documents, [sent], paperOf(bundle, at));
            pending.push(sent);
        } catch (error) {
            const { message } = error as Error;
            notices.push({ kind, slot: slotLabel(op), message, op });
            refused.push({ op, message });
        }
    }
    return { documents, pending, notices, refused };
}

/** The ops of `ops` that `bundle` has not stored. */
export function unstored(bundle: ReviewBundle, ops: Op[]): Op[] {
    const stored = new Set(bundle.ops.map((s) => s.op.client_op_id));
    return ops.filter((op) => !stored.has(op.client_op_id));
}

/** Saving stopped on the ops of `pending` in the emitBatch group of a `refused` op, for `reason`. */
export function blockedFrom(
    refused: Op[],
    pending: Op[],
    groupOf: Record<string, string>,
    problems: string[],
    reason: string
): Blocked {
    const groupOfOp = (op: Op) => groupOf[op.client_op_id] ?? op.client_op_id;
    const groups = new Set(refused.map(groupOfOp));
    return {
        clientOpIds: pending.filter((op) => groups.has(groupOfOp(op))).map((op) => op.client_op_id),
        problems,
        reason,
    };
}

/**
 * The ops kept on this device but those `bundle` has stored, replayed on it as a rebase replays them, with the
 * documents after them; blocked on the groups of any it refuses, which stay pending as they were kept.
 */
export function restored(bundle: ReviewBundle, { ops, groupOf, intents }: KeptOps, at: string) {
    const kept = unstored(bundle, ops);
    const replayed = replay(bundle, documentsOf(bundle), kept, at, 'conflict', carrying(intents));
    const rebuilt = new Map(replayed.pending.map((op) => [op.client_op_id, op]));
    const ids = new Set(kept.map((op) => op.client_op_id));
    const { refused } = replayed;
    return {
        documents: replayed.documents,
        pending: kept.map((op) => rebuilt.get(op.client_op_id) ?? op),
        groupOf: only(groupOf, ids),
        intents: only(intents, ids),
        blocked:
            refused.length > 0
                ? blockedFrom(
                      refused.map(({ op }) => op),
                      kept,
                      groupOf,
                      refused.map(({ op, message }) => `${slotLabel(op)}: ${message}`),
                      KEPT_REFUSED
                  )
                : null,
    };
}
