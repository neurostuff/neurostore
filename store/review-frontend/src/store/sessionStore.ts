import { createStore } from 'zustand';
import { withState, type OpResult, type ReviewLifecycle, type SetAside } from '../api/reviewApi';
import type { ReviewBundle, StoredOp } from '../contract/generated/review-bundle';
import type { CreateEntityOp, Op, SetEvidenceOp, Span } from '../contract/generated/review-ops';
import { isLocalOp, type AnnotationMap, type ProvenanceMap } from '../model/applyOp';
import { currentAnalyses, keepUnchanged, type CoordinateParse } from '../model/coordinates';
import { spansToUtf16 } from '../model/offsets';
import { mintLocalId } from '../model/mint';
import { randomUUID } from '../model/uuid';
import type { Json } from '../model/paths';
import { buildRecordIndex, withSlotFrom, type RecordIndex, type SlotNode, type SpanPair } from '../model/record';
import { slotTarget, targetKey } from '../model/targetKey';
import { declaredOf } from './declared';
import {
    blockedFrom,
    carrying,
    documentsOf,
    KEPT_REFUSED,
    replay,
    restored,
    slotLabel,
    unstored,
    waits,
    withSpan,
} from './keptOps';
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

/** How this tab keeps its pending ops: in memory only, loading them, on the device, or not at all (read-only). */
export type DeviceStatus = 'memory' | 'loading' | 'kept' | 'readonly';

export type SaveStatus = 'idle' | 'saving' | 'offline' | 'closed' | 'signin' | 'failed';

/** A save stopped on ops the server, or the replay of ops kept on this device, refused without naming one. */
export interface Blocked {
    clientOpIds: string[];
    problems: string[];
    /** Why saving stopped, in the reviewer's terms. */
    reason: string;
}

const UNNAMED_REFUSAL = 'the server refused an edit and did not say which one';

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

/** Pending ops as this device keeps them: in order, with their emitBatch groups and evidence intents. */
export interface KeptOps {
    ops: Op[];
    /** The client_op_id opening the emitBatch group of each op that came in one. */
    groupOf: Record<string, string>;
    intents: Record<string, EvidenceIntent>;
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
    device: DeviceStatus;
    deviceNotice: string;
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
    setDevice(device: DeviceStatus, notice?: string): void;
    /** Stops saving on a refused batch; its ops stay pending until the reviewer discards or undoes them. */
    block(batch: Op[], message: string, problems: string[]): void;
    /** Drops every pending op, rebuilding the record from the confirmed one. */
    discardPending(): void;
    /** Drops the pending ops of the refused batch, rebuilding the record from the confirmed one. */
    undoBlocked(): void;
    confirm(result: OpResult, sent: Op[]): void;
    rebase(fresh: ReviewBundle): void;
    /** Puts ops kept on this device in pending, but those the bundle has stored, replayed as a rebase replays them. */
    restore(kept: KeptOps): void;
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

const toSpan = ([start_char, end_char]: SpanPair): Span => ({ start_char, end_char });

export const canAddEvidence = (slot: SlotNode | undefined): slot is SlotNode =>
    slot?.kind === 'value' && slot.value?.extraction_status === 'extracted';

export const selectIsLoading = (s: Pick<SessionState, 'device'>): boolean => s.device === 'loading';

/** Whether edits are taken: not while the device's kept ops load, nor in a tab another one holds the review in. */
export const selectIsEditable = (s: Pick<SessionState, 'device'>): boolean =>
    !selectIsLoading(s) && s.device !== 'readonly';

export const selectIsBlocked = (s: Pick<SessionState, 'blocked'>): boolean => s.blocked != null;

export const selectCanUndo = (s: Pick<SessionState, 'blocked' | 'undoStack' | 'device'>): boolean =>
    selectIsEditable(s) && !selectIsBlocked(s) && s.undoStack.length > 0;

export const selectCanRedo = (s: Pick<SessionState, 'blocked' | 'redoStack' | 'device'>): boolean =>
    selectIsEditable(s) && !selectIsBlocked(s) && s.redoStack.length > 0;

export function selectSaveLabel({
    save,
    saveMessage,
    pending,
    blocked,
    device,
}: Pick<SessionState, 'save' | 'saveMessage' | 'pending' | 'blocked' | 'device'>): string {
    if (save === 'failed' || blocked != null) return saveMessage;
    if (save === 'signin') return 'sign in to save';
    if (save === 'offline') return device === 'kept' ? 'offline; saved on this device' : save;
    if (save === 'saving') return save;
    return pending.length ? `${pending.length} unsaved` : 'saved';
}

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

/** A stored op as the bundle logs it: without the inverse an op result adds. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const logged = ({ inverse, ...rest }: StoredOp): StoredOp => rest;

/** The actions that make, drop or send edits: each does nothing, and returns false, while no edits are taken. */
const EDITS = [
    'emit',
    'emitBatch',
    'addEvidence',
    'discardPending',
    'undoBlocked',
    'setLifecycle',
    'undo',
    'redo',
] as const satisfies (keyof SessionState)[];

function whileEditable<K extends keyof SessionState>(
    state: SessionState,
    names: readonly K[],
    editable: () => boolean
) {
    const guarded = names.map((name) => {
        const act = state[name] as (...args: unknown[]) => unknown;
        return [name, (...args: unknown[]) => (editable() ? act(...args) : false)];
    });
    return Object.fromEntries(guarded) as Pick<SessionState, K>;
}

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

        const initial: SessionState = {
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
            device: 'memory',
            deviceNotice: '',
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
            setDevice: (device, notice) => {
                if (notice === undefined) set({ device });
                else set({ device, deviceNotice: notice });
            },
            block: (batch, message, problems) =>
                set({
                    save: 'failed',
                    saveMessage: message,
                    blocked: blockedFrom(batch, batch, get().groupOf, problems, UNNAMED_REFUSAL),
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
                const next = toDomBundle(fresh);
                const { pending, intents, bundle: current } = get();
                withDocuments(next, unstored(next, pending), [], null, carrying(intents), undefined, {
                    before: current,
                    sent: [],
                });
            },
            restore: (entry) => {
                const { bundle: current } = get();
                const { documents, blocked, ...kept } = restored(current, entry, now());
                set({
                    ...documents,
                    ...kept,
                    index: rebuiltIndex(current, documents.record),
                    blocked,
                    ...(blocked && { save: 'failed', saveMessage: KEPT_REFUSED }),
                    replaced: { before: current, sent: [] },
                });
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
        return { ...initial, ...whileEditable(initial, EDITS, () => selectIsEditable(get())) };
    });
}
