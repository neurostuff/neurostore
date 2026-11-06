import { createStore } from 'zustand';
import { withState, type OpResult, type ReviewLifecycle, type SetAside } from '../api/reviewApi';
import type { ReviewBundle, StoredOp } from '../contract/generated/review-bundle';
import type { CreateEntityOp, Op, SetEvidenceOp, Span } from '../contract/generated/review-ops';
import { isLocalOp, type AnnotationMap, type ProvenanceMap } from '../model/applyOp';
import { currentAnalyses, keepUnchanged, type CoordinateParse, type CoordinatePoint } from '../model/coordinates';
import { spansToUtf16 } from '../model/offsets';
import { mintLocalId } from '../model/mint';
import { randomUUID } from '../model/uuid';
import type { Json } from '../model/paths';
import { buildRecordIndex, withSlotFrom, type RecordIndex, type SlotNode, type SpanPair } from '../model/record';
import { slotTarget, targetKey } from '../model/targetKey';
import { declaredOf } from './declared';
import { followerOf, keysNamed, type Follower } from '../model/analysisFollow';
import {
    collectedByAnalysis,
    followCollected,
    keptThroughRefusal,
    KEPT_EDITS,
    pointsAfter,
    samePoints,
    type PointEdit,
} from './pointEdits';
import {
    basisOf,
    followQueued,
    heldEdit,
    heldId,
    heldOnto,
    KEPT_ACTION,
    pullStaleWork,
    type Bases,
    type HeldOp,
} from './queuedWork';
import {
    blockedFrom,
    carrying,
    documentsOf,
    evidenceFor,
    KEPT_REFUSED,
    only,
    replay,
    restored,
    slotLabel,
    unstored,
    waits,
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
    kind: 'conflict' | 'refused' | 'dangling' | 'split' | 'undo' | 'redo' | 'kept';
    slot: string;
    message: string;
    /** The op dropped, for naming what it was in the reviewer's terms. */
    op?: Op;
}

/**
 * An edit of one slot's evidence, made again on top of the record a rebase brings; a null `span` removes `from`.
 * A `set_index` of 'new' comes only from intents an earlier version kept on this device.
 */
export type EvidenceIntent =
    | { kind: 'add_span'; slot: string; set_index: number | 'new'; span: Span }
    | { kind: 'replace_span'; slot: string; from: Span; span: Span | null };

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
    /** The point edits collected and not yet sent; absent when there are none. */
    collected?: PointEdit[];
    /** The basis of each pending op made on its analysis's points; absent when there are none. */
    basis?: Bases;
    /** The ops kept unsent because their analysis no longer holds the points they were made on; absent when none. */
    heldOps?: HeldOp[];
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
    /** The points each pending split or edit_points is applied over, by client_op_id, checked when it is re-aimed. */
    basis: Bases;
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
    /** Adds `span` to the set `setIndex` of the slot `slot`'s evidence, past its last set a new one; false when the slot takes no evidence. */
    addEvidence(slot: string, span: SpanPair, setIndex: number): boolean;
    /** Moves the span `from` of the slot `slot`'s evidence to `to`, in the set it is in; false when it has no such span. */
    moveEvidence(slot: string, from: SpanPair, to: SpanPair): boolean;
    /** Removes the span `span` from the slot `slot`'s evidence; false when it has no such span. */
    removeEvidence(slot: string, span: SpanPair): boolean;
    /** Moves the span `span` of the slot `from`'s evidence to the first set of the slot `to`, as one intent. */
    transferEvidence(from: string, span: SpanPair, to: string): boolean;
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
    /** The reviewer's point edits not yet sent, in the order made; shown at once, sent by `sendCollected`. */
    collected: PointEdit[];
    /** The collected edits undone before they were sent, the last undone last; a new edit clears them. */
    uncollected: PointEdit[];
    /** Collects an edit giving the analysis `key` the points `points`; false when it changes nothing. */
    collect(key: string, points: CoordinatePoint[]): boolean;
    /**
     * Sends the collected edits as one batch and one undo step: an edit_points of each analysis's latest points,
     * queued behind any pending op on it; held edits stay. False when none is sent. Only the op client calls it.
     */
    sendCollected(): boolean;
    /** Drops the collected edits of the analysis `key`, which then shows the points the server has. */
    discardCollected(key: string): void;
    /** How many times a view or an action asked for the collected edits to be sent now; the op client sends them. */
    sendAsked: number;
    /** Asks the op client to send the collected edits now. */
    askToSend(): void;
    /**
     * The reviewer's work kept unsent, in the order kept: ops whose analysis no longer holds the points they were
     * made on, and collected edits that could not follow their analysis.
     */
    heldOps: HeldOp[];
    /** Sends the held op `id` on the analysis `to`, its points remapped there; false when they cannot be. */
    applyHeldOp(id: string, to: string): boolean;
    /** Drops the held op `id`. */
    discardHeldOp(id: string): void;
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

export const selectCanUndo = (s: Pick<SessionState, 'blocked' | 'undoStack' | 'device' | 'collected'>): boolean =>
    selectIsEditable(s) && (s.collected.length > 0 || (!selectIsBlocked(s) && s.undoStack.length > 0));

export const selectCanRedo = (s: Pick<SessionState, 'blocked' | 'redoStack' | 'device' | 'uncollected'>): boolean =>
    selectIsEditable(s) && (s.uncollected.length > 0 || (!selectIsBlocked(s) && s.redoStack.length > 0));

const NO_POINTS: CoordinatePoint[] = [];

/** The points of the analysis `key` as the server has them, or as its last pending edit_points gives them. */
const sentPoints = ({ bundle, pending }: Pick<SessionState, 'bundle' | 'pending'>, key: string): CoordinatePoint[] =>
    pointsAfter(currentAnalyses(bundle), pending, key) ?? NO_POINTS;

/** The points of the analysis `key` as the reviewer last left them: collected, pending, or as the server has them. */
export const selectShownPoints = (s: Pick<SessionState, 'bundle' | 'pending' | 'collected'>, key: string) =>
    s.collected.findLast((edit) => edit.key === key)?.points ?? sentPoints(s, key);

export function selectSaveLabel({
    save,
    saveMessage,
    pending,
    blocked,
    device,
    collected,
    heldOps,
}: Pick<SessionState, 'save' | 'saveMessage' | 'pending' | 'blocked' | 'device' | 'collected' | 'heldOps'>): string {
    if (save === 'failed' || blocked != null) return saveMessage;
    if (save === 'signin') return 'sign in to save';
    if (save === 'offline') return device === 'kept' ? 'offline; saved on this device' : save;
    if (save === 'saving') return save;
    const unsaved = pending.length + collected.length + heldOps.length;
    return unsaved ? `${unsaved} unsaved` : 'saved';
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
    'moveEvidence',
    'removeEvidence',
    'transferEvidence',
    'discardPending',
    'undoBlocked',
    'setLifecycle',
    'undo',
    'redo',
    'collect',
    'sendCollected',
    'discardCollected',
    'askToSend',
    'applyHeldOp',
    'discardHeldOp',
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

/** The notice that the edits collected on the analysis named `slot` are kept, not sent. */
const keptNotice = (slot: string, message: string): Notice => ({ kind: 'kept', slot, message });

/**
 * The one path that re-aims the reviewer's work once the follower's analyses replace the ones it was made on: the
 * pending ops by `followQueued`, the collected edits by `followCollected`; what cannot follow is held, with a notice
 * for each analysis it was on.
 */
function followed(
    follower: Follower,
    pending: Op[],
    groupOf: Record<string, string>,
    collected: PointEdit[],
    bases: Bases
) {
    const queued = followQueued(follower, pending, groupOf, bases);
    const edits = followCollected(collected, follower);
    const held = [...queued.held, ...edits.stranded.map(({ edit, kept }) => heldEdit(edit, kept))];
    return {
        ...queued,
        collected: edits.collected,
        held,
        notices: [
            ...queued.held.map((work) => keptNotice(work.name, KEPT_ACTION)),
            ...edits.stranded.map(({ edit }) => keptNotice(edit.name, KEPT_EDITS)),
        ],
    };
}

/** The entries of `byOp` for the ops `ops`. */
const onlyOf = <T>(byOp: Record<string, T>, ops: Op[]) => only(byOp, new Set(ops.map((op) => op.client_op_id)));

/** What `withDocuments` replays besides the documents: by default nothing more, and the edits collected now. */
interface Rebuild {
    notices?: Notice[];
    touched?: string[] | null;
    carry?: (record: Json, op: Op) => Op;
    answers?: Map<string, InverseOp[]>;
    replaced?: Replaced;
    collected?: PointEdit[];
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
            given: Op[],
            {
                notices = [],
                touched = null,
                carry,
                answers = new Map<string, InverseOp[]>(),
                replaced,
                collected = get().collected,
            }: Rebuild = {}
        ) => {
            const state = get();
            const unchanged = currentAnalyses(state.bundle) === currentAnalyses(next);
            const aimed = unchanged
                ? { pending: given, collected, notices: [], held: [], groupOf: {}, basis: {} }
                : followed(followerOf(state.bundle, next), given, state.groupOf, collected, state.basis);
            const { pending } = aimed;
            const replayed = replay(next, documentsOf(next), pending, now(), 'conflict', carry);
            const { record } = replayed.documents;
            const intents = onlyOf(state.intents, replayed.pending);
            const sameEntities =
                JSON.stringify(next.hidden) === JSON.stringify(state.bundle.hidden) &&
                JSON.stringify(next.entities) === JSON.stringify(state.bundle.entities);
            const index =
                touched && sameEntities
                    ? touched.reduce((edited, key) => withSlotFrom(edited, record, key), state.index)
                    : rebuiltIndex(next, record);
            const groupOf = onlyOf({ ...state.groupOf, ...aimed.groupOf }, replayed.pending);
            set({
                bundle: next,
                ops: next.ops,
                ...replayed.documents,
                pending: replayed.pending,
                groupOf,
                intents,
                basis: onlyOf({ ...state.basis, ...aimed.basis }, replayed.pending),
                heldOps: aimed.held.length ? [...state.heldOps, ...aimed.held] : state.heldOps,
                index,
                collected: aimed.collected,
                uncollected: aimed.collected === state.collected ? state.uncollected : [],
                notices: [...state.notices, ...notices, ...aimed.notices, ...replayed.notices],
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
        const pushBatch = (
            ops: Op[],
            kind: Notice['kind'],
            also: Partial<SessionState>,
            collected: boolean
        ): boolean => {
            const state = get();
            const pending = [...state.pending, ...ops];
            const made = basisOf(currentAnalyses(state.bundle), state.pending, ops, collected);
            const basis = Object.keys(made).length ? { ...state.basis, ...made } : state.basis;
            const groupOf =
                ops.length > 1
                    ? {
                          ...state.groupOf,
                          ...Object.fromEntries(ops.map((op) => [op.client_op_id, ops[0].client_op_id])),
                      }
                    : state.groupOf;
            if (ops.some((op) => waits(state.pending, op))) {
                set({ pending, groupOf, basis, ...also });
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
            set({ ...documents, index, pending, groupOf, basis, ...also });
            return true;
        };

        /** Puts the ops of one user intent in pending, as one undo step; false when the core refuses them. */
        const pushEdit = (ops: Op[], collected = false): boolean => {
            const { undoStack, redoStack } = get();
            const undone = ops.filter((op) => !NOT_UNDONE.has(op.type)).map((op) => op.client_op_id);
            return pushBatch(
                ops,
                'refused',
                {
                    undoStack: undone.length ? [...undoStack, { ops: undone, inverses: {} }] : undoStack,
                    redoStack: redoStack.length ? [] : redoStack,
                    waitingTo: null,
                },
                collected
            );
        };

        /** The edit_points op giving the analysis `key` the points `points`. */
        const editPointsOp = (key: string, points: CoordinatePoint[]): Op => ({
            client_op_id: randomUUID(),
            type: 'coordinate',
            target: { kind: 'coordinate_analysis', analysis_key: key },
            action: 'edit_points',
            payload: { points },
        });

        /** Moves the last edit of `from` to the other of the collected and the uncollected edits. */
        const stepCollected = (from: 'collected' | 'uncollected') => {
            const state = get();
            const to = from === 'collected' ? 'uncollected' : 'collected';
            const last = state[from].at(-1);
            if (last) set({ [from]: state[from].slice(0, -1), [to]: [...state[to], last] });
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
            if (!pushBatch(ops, from, { ...moved, waitingTo: null }, false)) set({ waitingTo: null });
        };

        /** The set_evidence op giving `slot` the evidence `intent` makes of its own; null when the intent is refused. */
        const intentOp = (slot: SlotNode, intent: EvidenceIntent): SetEvidenceOp | null => {
            const intended = evidenceFor(slot.value?.evidence, intent);
            if ('refused' in intended) return null;
            return {
                client_op_id: randomUUID(),
                type: 'set_evidence',
                target: slotTarget(slot.entity, slot.path),
                evidence: intended.evidence,
            };
        };

        /** Sends the set_evidence ops of the evidence intents as one undo step, each kept with the intent a rebase makes again. */
        const pushIntents = (edits: [SlotNode, EvidenceIntent][]): boolean => {
            const ops = edits.map(([slot, intent]) => intentOp(slot, intent));
            if (ops.some((op) => op === null) || !pushEdit(ops as SetEvidenceOp[])) return false;
            const kept = Object.fromEntries(ops.map((op, i) => [op!.client_op_id, edits[i][1]]));
            set((s) => ({ intents: { ...s.intents, ...kept } }));
            return true;
        };

        const pushIntent = (slot: SlotNode, intent: EvidenceIntent) => pushIntents([[slot, intent]]);

        /** Sends the slot's evidence with the span `from` replaced by `to`, or left out when `to` is null. */
        const replaceSpan = (key: string, from: SpanPair, to: SpanPair | null): boolean => {
            const slot = get().index.slot(key);
            if (slot?.kind !== 'value') return false;
            return pushIntent(slot, { kind: 'replace_span', slot: key, from: toSpan(from), span: to && toSpan(to) });
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
            basis: {},
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
            collected: [],
            uncollected: [],
            sendAsked: 0,
            heldOps: [],

            addEvidence: (key, span, setIndex) => {
                const slot = get().index.slot(key);
                if (!canAddEvidence(slot)) return false;
                return pushIntent(slot, { kind: 'add_span', slot: slot.key, set_index: setIndex, span: toSpan(span) });
            },
            moveEvidence: (key, from, to) => replaceSpan(key, from, to),
            removeEvidence: (key, span) => replaceSpan(key, span, null),
            transferEvidence: (fromKey, span, toKey) => {
                const { index } = get();
                const from = index.slot(fromKey);
                const to = index.slot(toKey);
                if (fromKey === toKey || from?.kind !== 'value' || !canAddEvidence(to)) return false;
                return pushIntents([
                    [from, { kind: 'replace_span', slot: fromKey, from: toSpan(span), span: null }],
                    [to, { kind: 'add_span', slot: toKey, set_index: 0, span: toSpan(span) }],
                ]);
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
                withDocuments(get().bundle, [], { collected: [] });
                set({ uncollected: [], heldOps: [], save: 'idle', saveMessage: '', blocked: null });
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
                    {
                        notices: dangling,
                        touched: sent.every(isLocalOp) ? touched : null,
                        answers: inverses,
                        replaced: { before: current, sent },
                    }
                );
                const { waitingTo } = get();
                if (waitingTo) sendInverse(waitingTo);
            },
            rebase: (fresh) => {
                const next = toDomBundle(fresh);
                const { pending, intents, bundle: current } = get();
                withDocuments(next, unstored(next, pending), {
                    carry: carrying(intents),
                    replaced: { before: current, sent: [] },
                });
            },
            restore: (entry) => {
                const { bundle: current } = get();
                const aimed = followed(
                    followerOf(current, current, current.ops),
                    unstored(current, entry.ops),
                    entry.groupOf,
                    entry.collected ?? [],
                    entry.basis ?? {}
                );
                const { documents, blocked, ...kept } = restored(
                    current,
                    { ...entry, ops: aimed.pending, groupOf: { ...entry.groupOf, ...aimed.groupOf } },
                    now()
                );
                set({
                    ...documents,
                    ...kept,
                    basis: onlyOf({ ...entry.basis, ...aimed.basis }, kept.pending),
                    heldOps: [...(entry.heldOps ?? []), ...aimed.held],
                    collected: aimed.collected,
                    notices: [...get().notices, ...aimed.notices],
                    index: rebuiltIndex(current, documents.record),
                    blocked,
                    ...(blocked && { save: 'failed', saveMessage: KEPT_REFUSED }),
                    replaced: { before: current, sent: [] },
                });
            },
            refuse: (refusals) => {
                const { undoStack, redoStack, bundle: current, pending, groupOf, collected, basis, heldOps } = get();
                const refused = new Set(refusals.map((r) => r.op.client_op_id));
                const { kinds, dropped } = revertedBy({ undoStack, redoStack }, refused);
                const analyses = currentAnalyses(current);
                const named = (key: string) => analyses.find((analysis) => analysis.key === key)?.name ?? key;
                const messageOf = (key: string) =>
                    (refusals.find(({ op }) => keysNamed(op).includes(key)) ?? refusals[0]).message;
                const stale = pullStaleWork(
                    pending.filter((op) => !dropped.has(op.client_op_id)),
                    groupOf,
                    basis,
                    analyses,
                    messageOf
                );
                const left = stale.kept;
                set({ heldOps: [...heldOps, ...stale.held] });
                withDocuments(current, left, {
                    notices: refusals.map(({ op, message }) => ({
                        kind: kinds[op.client_op_id] ?? 'refused',
                        slot: slotLabel(op),
                        message,
                        op,
                    })),
                    collected: keptThroughRefusal(
                        [...stale.edits, ...collected],
                        refusals,
                        (key) => sentPoints({ bundle: current, pending: left }, key),
                        named
                    ),
                });
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
            undo: () => (get().collected.length ? stepCollected('collected') : sendInverse('undo')),
            redo: () => (get().uncollected.length ? stepCollected('uncollected') : sendInverse('redo')),
            collect: (key, points) => {
                const state = get();
                const analysis = currentAnalyses(state.bundle).find((candidate) => candidate.key === key);
                if (!analysis) return false;
                const base = selectShownPoints(state, key);
                if (samePoints(base, points)) return false;
                const freed = state.collected.map((edit) =>
                    edit.key === key && edit.held ? { ...edit, held: undefined } : edit
                );
                set({
                    collected: [...freed, { key, name: analysis.name, base, points }],
                    uncollected: [],
                    redoStack: state.redoStack.length ? [] : state.redoStack,
                });
                return true;
            },
            sendCollected: () => {
                const state = get();
                const known = new Set(currentAnalyses(state.bundle).map((analysis) => analysis.key));
                const ready = collectedByAnalysis(state.collected).filter((edit) => known.has(edit.key) && !edit.held);
                if (!ready.length) return false;
                const sending = new Set(ready.map((edit) => edit.key));
                set({ collected: state.collected.filter((edit) => !sending.has(edit.key)), uncollected: [] });
                const ops = ready
                    .filter((edit) => !samePoints(edit.points, sentPoints(state, edit.key)))
                    .map((edit) => editPointsOp(edit.key, edit.points));
                return ops.length > 0 && pushEdit(ops, true);
            },
            discardCollected: (key) => {
                const { collected, uncollected } = get();
                set({
                    collected: collected.filter((edit) => edit.key !== key),
                    uncollected: uncollected.filter((edit) => edit.key !== key),
                });
            },
            askToSend: () => set((s) => ({ sendAsked: s.sendAsked + 1 })),
            applyHeldOp: (id, to) => {
                const state = get();
                const held = state.heldOps.find((work) => heldId(work) === id);
                if (!held) return false;
                const placed = heldOnto(held, to, currentAnalyses(state.bundle), state.pending);
                if (!('ops' in placed)) return false;
                state.discardHeldOp(id);
                return pushEdit(placed.ops);
            },
            discardHeldOp: (id) => set((s) => ({ heldOps: s.heldOps.filter((work) => heldId(work) !== id) })),
        };
        return { ...initial, ...whileEditable(initial, EDITS, () => selectIsEditable(get())) };
    });
}
