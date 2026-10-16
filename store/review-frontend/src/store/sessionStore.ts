import { createStore } from 'zustand';
import { withState, type OpResult, type ReviewLifecycle, type SetAside } from '../api/reviewApi';
import type { ReviewBundle, StoredOp } from '../contract/generated/review-bundle';
import type { CreateEntityOp, Evidence, Op, SetEvidenceOp, Span } from '../contract/generated/review-ops';
import {
    applyBatch,
    isLocalOp,
    type AnnotationMap,
    type Documents,
    type Paper,
    type ProvenanceMap,
} from '../model/applyOp';
import { currentAnalyses, keepUnchanged, type CoordinateParse } from '../model/coordinates';
import { spansToUtf16, utf16Paper } from '../model/offsets';
import { mintLocalId } from '../model/mint';
import { randomUUID } from '../model/uuid';
import { entityPath, getIn, readPath, type Json } from '../model/paths';
import { buildRecordIndex, withSlotFrom, type RecordIndex, type SlotNode, type SpanPair } from '../model/record';
import { slotTarget, targetKey } from '../model/targetKey';
import { declaredOf } from './declared';
import {
    answerSteps,
    isReady,
    NOT_UNDONE,
    revertedBy,
    settled,
    undoing,
    type InverseOp,
    type UndoStep,
} from './undoSteps';

export type EvidenceMode = 'first' | 'new';

export type SaveStatus = 'idle' | 'saving' | 'offline' | 'closed' | 'signin' | 'failed';

/** A save the server refused without naming an op: its batch, and what the server said. */
export interface Blocked {
    clientOpIds: string[];
    problems: string[];
}

export interface Notice {
    kind: 'conflict' | 'refused' | 'dangling' | 'split' | 'undo' | 'redo';
    slot: string;
    message: string;
}

export type EvidenceIntent = { kind: 'add_span'; slot: string; set_index: number | 'new'; span: Span };

export interface Refusal {
    op: Op;
    message: string;
}

/** A server answer to `sent`, or a rebase with nothing sent, that replaced the documents of `before`. */
export interface Replaced {
    before: ReviewBundle;
    sent: Op[];
}

export interface SessionState {
    bundle: ReviewBundle;
    record: Json;
    provenance: ProvenanceMap;
    annotations: AnnotationMap;
    index: RecordIndex;
    ops: StoredOp[];
    pending: Op[];
    /** The client_op_id that opens the emitBatch group each pending op came in, keyed by op. */
    groupOf: Record<string, string>;
    intents: Record<string, EvidenceIntent>;
    blocked: Blocked | null;
    save: SaveStatus;
    saveMessage: string;
    notices: Notice[];
    undoStack: UndoStep[];
    redoStack: UndoStep[];
    /** The undo or redo asked for while the step it takes was unconfirmed, run once the server confirms it. */
    waitingTo: 'undo' | 'redo' | null;
    /** The last confirm or rebase, for a view to follow what it made or removed. */
    replaced: Replaced | null;
    /** Puts an op in pending: applied at once when it is local, held unapplied when the server applies it. */
    emit(op: Op): boolean;
    /** Puts the ops of one intent in pending as one batch, sent in one request whatever the save timing. */
    emitBatch(ops: Op[]): boolean;
    /** Adds `span` to the evidence of the slot `slot`; false when the slot takes no evidence. */
    addEvidence(slot: string, span: SpanPair, mode: EvidenceMode): boolean;
    /** Resolves once the local_id of a pending create_entity op is minted. */
    minted(clientOpId: string): Promise<void>;
    setSave(save: SaveStatus, message?: string): void;
    /** Stops saving on a refused batch; its ops stay pending until the reviewer discards or undoes them. */
    block(batch: Op[], message: string, problems: string[]): void;
    /** Drops every pending op, rebuilding the record from the confirmed one. */
    discardPending(): void;
    /** Drops the pending ops of the refused batch, rebuilding the record from the confirmed one. */
    undoBlocked(): void;
    confirm(result: OpResult, sent: Op[]): void;
    rebase(fresh: ReviewBundle): void;
    refuse(refusals: Refusal[]): void;
    /** Sets the review's state, with its set-aside reason while it is set aside. */
    setLifecycle(state: ReviewLifecycle, setAside?: SetAside): void;
    dismissNotices(): void;
    /** Sends the inverse of the last user intent as one batch, and moves it to the redo stack. */
    undo(): void;
    /** Sends the inverse of the last undo as one batch, and moves it back to the undo stack. */
    redo(): void;
}

export type SessionStore = ReturnType<typeof createSessionStore>;

type EvidenceSet = NonNullable<Evidence['sets']>[number];

const toSpan = ([start_char, end_char]: SpanPair): Span => ({ start_char, end_char });
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

/** The set_evidence op an intent makes on top of `record`; other ops pass through. */
function carried(record: Json, op: Op, intent: EvidenceIntent | undefined): Op {
    if (!intent || op.type !== 'set_evidence' || op.target.kind !== 'slot') return op;
    const item = getIn(record, entityPath(record, op.target.entity) ?? []);
    const wrapper = readPath(item, op.target.path) as { evidence?: Evidence } | undefined;
    return { ...op, evidence: withSpan(wrapper?.evidence, intent.span, intent.set_index) };
}

export const canAddEvidence = (slot: SlotNode | undefined): slot is SlotNode =>
    slot?.kind === 'value' && slot.value?.extraction_status === 'extracted';

export const selectIsBlocked = (s: Pick<SessionState, 'blocked'>): boolean => s.blocked != null;

export const selectCanUndo = (s: Pick<SessionState, 'blocked' | 'undoStack'>): boolean =>
    !selectIsBlocked(s) && s.undoStack.length > 0;

export const selectCanRedo = (s: Pick<SessionState, 'blocked' | 'redoStack'>): boolean =>
    !selectIsBlocked(s) && s.redoStack.length > 0;

export function selectSaveLabel({
    save,
    saveMessage,
    pending,
    blocked,
}: Pick<SessionState, 'save' | 'saveMessage' | 'pending' | 'blocked'>): string {
    if (save === 'failed' || blocked != null) return saveMessage;
    if (save === 'signin') return 'sign in to save';
    if (save === 'saving' || save === 'offline') return save;
    return pending.length ? `${pending.length} unsaved` : 'saved';
}

const slotLabel = (op: Op) => {
    if (!('target' in op)) return op.type;
    return op.target.kind === 'slot' ? `${op.target.entity} ${op.target.path}` : targetKey(op.target);
};

const documentsOf = (bundle: ReviewBundle): Documents => ({
    record: bundle.record as Json,
    provenance: bundle.review?.provenance ?? {},
    annotations: bundle.review?.annotations ?? {},
});

/** The bundle with its span offsets in UTF-16 code units, as the DOM counts them. */
const toDomBundle = (bundle: ReviewBundle): ReviewBundle => {
    const { text } = bundle;
    return {
        ...bundle,
        record: spansToUtf16(text, bundle.record),
        original: { ...bundle.original, record: spansToUtf16(text, bundle.original.record) },
        coordinate_parse: spansToUtf16(text, bundle.coordinate_parse),
        coordinate_revision: spansToUtf16(text, bundle.coordinate_revision),
        review: bundle.review && { ...bundle.review, annotations: spansToUtf16(text, bundle.review.annotations) },
    };
};

const paperOf = (bundle: ReviewBundle, at: string): Paper => ({
    text: utf16Paper(bundle.text),
    userId: bundle.review?.user_id ?? '',
    at,
    coordinateParse: bundle.coordinate_parse as CoordinateParse,
    coordinateRevision: bundle.coordinate_revision as CoordinateParse | null,
    entities: bundle.entities,
});

/** Whether `op` waits for the server: it is one the server applies, or one is pending before it. */
const waits = (before: Op[], op: Op) => !isLocalOp(op) || before.some((p) => !isLocalOp(p));

/**
 * The ops kept pending, in order, with the documents after the ones applied: an op that waits is kept
 * unapplied, and one the core refuses is dropped with a notice of `kind`. `carry` may rewrite an op
 * before it is applied.
 */
function replay(
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
    for (const op of ops) {
        if (waits(pending, op)) {
            pending.push(op);
            continue;
        }
        const sent = carry(documents.record, op);
        try {
            documents = applyBatch(documents, [sent], paperOf(bundle, at));
            pending.push(sent);
        } catch (error) {
            notices.push({ kind, slot: slotLabel(op), message: (error as Error).message });
        }
    }
    return { documents, pending, notices };
}

/** A stored op as the bundle logs it: without the inverse an op result adds. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const logged = ({ inverse, ...rest }: StoredOp): StoredOp => rest;

export interface SessionStoreOptions {
    now?: () => string;
}

export function createSessionStore(
    loaded: ReviewBundle,
    { now = () => new Date().toISOString() }: SessionStoreOptions = {}
) {
    const bundle = toDomBundle(loaded);

    return createStore<SessionState>()((set, get) => {
        const rebuiltIndex = (next: ReviewBundle, record: Json) => buildRecordIndex({ ...next, record }, declaredOf);

        const withDocuments = (
            next: ReviewBundle,
            pending: Op[],
            notices: Notice[] = [],
            touched: string[] | null = null,
            carry?: (record: Json, op: Op) => Op,
            answers = new Map<string, InverseOp[]>(),
            replaced?: Replaced
        ) => {
            const state = get();
            const replayed = replay(next, documentsOf(next), pending, now(), 'conflict', carry);
            const { record } = replayed.documents;
            const intents = Object.fromEntries(
                replayed.pending
                    .filter((op) => op.client_op_id in state.intents)
                    .map((op) => [op.client_op_id, state.intents[op.client_op_id]])
            );
            const sameEntities =
                JSON.stringify(next.hidden) === JSON.stringify(state.bundle.hidden) &&
                JSON.stringify(next.entities) === JSON.stringify(state.bundle.entities);
            const index =
                touched && sameEntities
                    ? touched.reduce((edited, key) => withSlotFrom(edited, record, key), state.index)
                    : rebuiltIndex(next, record);
            const groupOf = Object.fromEntries(
                replayed.pending
                    .filter((op) => op.client_op_id in state.groupOf)
                    .map((op) => [op.client_op_id, state.groupOf[op.client_op_id]])
            );
            set({
                bundle: next,
                ops: next.ops,
                ...replayed.documents,
                pending: replayed.pending,
                groupOf,
                intents,
                index,
                notices: [...state.notices, ...notices, ...replayed.notices],
                ...settled(
                    answerSteps({ undoStack: state.undoStack, redoStack: state.redoStack }, answers),
                    new Set(replayed.pending.map((op) => op.client_op_id)),
                    new Set(next.ops.map((s) => s.op.client_op_id))
                ),
                ...(replaced && { replaced }),
            });
        };

        /**
         * Puts `ops` in pending as one batch, in the update that makes `also`: applied at once when none waits for
         * the server, else held unapplied. False, with a notice of `kind`, when the core refuses one.
         */
        const pushBatch = (ops: Op[], kind: Notice['kind'], also: Partial<SessionState>): boolean => {
            const state = get();
            const pending = [...state.pending, ...ops];
            const groupOf =
                ops.length > 1
                    ? {
                          ...state.groupOf,
                          ...Object.fromEntries(ops.map((op) => [op.client_op_id, ops[0].client_op_id])),
                      }
                    : state.groupOf;
            if (ops.some((op) => waits(state.pending, op))) {
                set({ pending, groupOf, ...also });
                return true;
            }
            const replayed = replay(state.bundle, state, ops, now(), kind);
            if (replayed.notices.length > 0) {
                set({ notices: [...state.notices, ...replayed.notices] });
                return false;
            }
            const { documents } = replayed;
            const index = ops.reduce((edited, op) => {
                const key = 'target' in op ? targetKey(op.target) : '';
                return key.startsWith('slot:') && !edited.slot(key)
                    ? rebuiltIndex(state.bundle, documents.record)
                    : withSlotFrom(edited, documents.record, key);
            }, state.index);
            set({ ...documents, index, pending, groupOf, ...also });
            return true;
        };

        /** Puts the ops of one user intent in pending, as one undo step; false when the core refuses them. */
        const pushEdit = (ops: Op[]): boolean => {
            const { undoStack, redoStack } = get();
            const undone = ops.filter((op) => !NOT_UNDONE.has(op.type)).map((op) => op.client_op_id);
            return pushBatch(ops, 'refused', {
                undoStack: undone.length ? [...undoStack, { ops: undone, inverses: {} }] : undoStack,
                redoStack: redoStack.length ? [] : redoStack,
                waitingTo: null,
            });
        };

        /** Sends the inverse of the top step of `from`, moving the step to the other stack once sent. */
        const sendInverse = (from: 'undo' | 'redo') => {
            const state = get();
            const top = (from === 'undo' ? state.undoStack : state.redoStack).at(-1);
            if (!top || selectIsBlocked(state)) {
                set({ waitingTo: null });
                return;
            }
            if (!isReady(top)) {
                set({ waitingTo: from });
                return;
            }
            const ops = undoing(top);
            const sent: UndoStep = { ops: ops.map((op) => op.client_op_id), inverses: {}, reverts: top };
            const { undoStack, redoStack } = state;
            const moved =
                from === 'undo'
                    ? { undoStack: undoStack.slice(0, -1), redoStack: [...redoStack, sent] }
                    : { redoStack: redoStack.slice(0, -1), undoStack: [...undoStack, sent] };
            if (!pushBatch(ops, from, { ...moved, waitingTo: null })) set({ waitingTo: null });
        };

        const mints = new Map<string, Promise<void>>();

        /** Fills in the local_id a create_entity op mints from its client_op_id, once the digest resolves. */
        const mintInto = (op: CreateEntityOp) => {
            const { bundle: current, pending } = get();
            const taken = new Set([
                ...current.entities.map((e) => e.local_id),
                ...pending.flatMap((p) => (p.type === 'create_entity' ? [(p.entity as Json).local_id as string] : [])),
            ]);
            mints.set(
                op.client_op_id,
                mintLocalId(op.client_op_id, taken).then((localId) =>
                    set((s) => ({
                        pending: s.pending.map((p) =>
                            p.type === 'create_entity' && p.client_op_id === op.client_op_id
                                ? { ...p, entity: { local_id: localId, ...p.entity } }
                                : p
                        ),
                    }))
                )
            );
        };

        return {
            bundle,
            ...documentsOf(bundle),
            index: buildRecordIndex(bundle, declaredOf),
            ops: bundle.ops,
            pending: [],
            groupOf: {},
            intents: {},
            blocked: null,
            save: 'idle',
            saveMessage: '',
            notices: [],
            undoStack: [],
            redoStack: [],
            waitingTo: null,
            replaced: null,

            addEvidence: (key, span, mode) => {
                const slot = get().index.slot(key);
                if (!canAddEvidence(slot)) return false;
                const intent: EvidenceIntent = {
                    kind: 'add_span',
                    slot: slot.key,
                    set_index: mode === 'new' ? 'new' : 0,
                    span: toSpan(span),
                };
                const op: SetEvidenceOp = {
                    client_op_id: randomUUID(),
                    type: 'set_evidence',
                    target: slotTarget(slot.entity, slot.path),
                    evidence: withSpan(slot.value?.evidence, intent.span, intent.set_index),
                };
                if (!pushEdit([op])) return false;
                set((s) => ({ intents: { ...s.intents, [op.client_op_id]: intent } }));
                return true;
            },
            minted: (clientOpId) => mints.get(clientOpId) ?? Promise.resolve(),
            setSave: (save, message = '') => set({ save, saveMessage: message }),
            block: (batch, message, problems) =>
                set({
                    save: 'failed',
                    saveMessage: message,
                    blocked: { clientOpIds: batch.map((op) => op.client_op_id), problems },
                }),
            discardPending: () => {
                withDocuments(get().bundle, []);
                set({ save: 'idle', saveMessage: '', blocked: null });
            },
            undoBlocked: () => {
                const { blocked, bundle: current, pending } = get();
                if (!blocked) return;
                const refused = new Set(blocked.clientOpIds);
                withDocuments(
                    current,
                    pending.filter((op) => !refused.has(op.client_op_id))
                );
                set({ save: 'idle', saveMessage: '', blocked: null });
            },
            confirm: (result, sent) => {
                const { bundle: current, ops, pending } = get();
                const before = currentAnalyses(current);
                const sentIds = new Set(sent.map((op) => op.client_op_id));
                const seqs = new Set(ops.map((s) => s.seq));
                const dom = spansToUtf16(current.text, {
                    record: result.record,
                    annotations: result.annotations,
                    coordinate_revision: result.coordinate_revision,
                });
                const parse = dom.coordinate_revision as CoordinateParse | null;
                const revision = parse && { ...parse, analyses: keepUnchanged(before, parse.analyses ?? []) };
                const review = current.review && {
                    ...current.review,
                    last_seq: result.last_seq,
                    provenance: result.provenance,
                    annotations: dom.annotations,
                };
                const rest = pending.filter((op) => !sentIds.has(op.client_op_id));
                const inverses = new Map(
                    result.ops.flatMap((s) =>
                        s.inverse ? [[s.op.client_op_id, spansToUtf16(current.text, s.inverse as InverseOp[])]] : []
                    )
                );
                const touched = [...sent, ...rest].flatMap((op) => ('target' in op ? [targetKey(op.target)] : []));
                const linked = (after: Record<string, unknown>, field: string, kind: Notice['kind']): Notice[] =>
                    Array.isArray(after[field])
                        ? (after[field] as { entity: string; path: string; target_entity: string }[]).map((ref) => ({
                              kind,
                              slot: `${ref.entity} ${ref.path}`,
                              message: `it points at ${ref.target_entity}`,
                          }))
                        : [];
                const dangling: Notice[] = result.ops.flatMap(({ op, after }) => [
                    ...(op.type === 'delete_entity' || op.type === 'coordinate'
                        ? linked(after, 'references', 'dangling')
                        : []),
                    ...(op.type === 'coordinate' ? linked(after, 'links', 'split') : []),
                ]);
                withDocuments(
                    {
                        ...current,
                        record: dom.record,
                        coordinate_revision: revision,
                        hidden: result.hidden,
                        entities: (result.entities as ReviewBundle['entities'] | undefined) ?? current.entities,
                        review,
                        ops: [...ops, ...result.ops.filter((s) => !seqs.has(s.seq)).map(logged)],
                    },
                    rest,
                    dangling,
                    sent.every(isLocalOp) ? touched : null,
                    undefined,
                    inverses,
                    { before: current, sent }
                );
                const { waitingTo } = get();
                if (waitingTo) sendInverse(waitingTo);
            },
            rebase: (fresh) => {
                const stored = new Set(fresh.ops.map((s) => s.op.client_op_id));
                const { pending, intents, bundle: current } = get();
                withDocuments(
                    toDomBundle(fresh),
                    pending.filter((op) => !stored.has(op.client_op_id)),
                    [],
                    null,
                    (record, op) => carried(record, op, intents[op.client_op_id]),
                    undefined,
                    { before: current, sent: [] }
                );
            },
            refuse: (refusals) => {
                const { undoStack, redoStack, bundle: current, pending } = get();
                const refused = new Set(refusals.map((r) => r.op.client_op_id));
                const { kinds, dropped } = revertedBy({ undoStack, redoStack }, refused);
                withDocuments(
                    current,
                    pending.filter((op) => !dropped.has(op.client_op_id)),
                    refusals.map(({ op, message }) => ({
                        kind: kinds[op.client_op_id] ?? 'refused',
                        slot: slotLabel(op),
                        message,
                    }))
                );
            },
            setLifecycle: (state, setAside) => {
                const { bundle: current } = get();
                if (!current.review) return;
                set({ bundle: { ...current, review: withState(current.review, state, setAside) } });
            },
            dismissNotices: () => set({ notices: [] }),
            emit: (op) => {
                if (op.type === 'create_entity' && !(op.entity as Json).local_id) mintInto(op);
                return pushEdit([op]);
            },
            emitBatch: (ops) => ops.length > 0 && pushEdit(ops),
            undo: () => sendInverse('undo'),
            redo: () => sendInverse('redo'),
        };
    });
}
