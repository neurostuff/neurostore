import { createStore } from 'zustand';
import type { OpResult, ReviewLifecycle } from '../api/reviewApi';
import type { ReviewBundle, StoredOp } from '../contract/generated/review-bundle';
import type { AnyTarget, CreateEntityOp, Evidence, Op, SetEvidenceOp, Span } from '../contract/generated/review-ops';
import {
    applyBatch,
    isLocalOp,
    type AnnotationMap,
    type Documents,
    type Paper,
    type ProvenanceMap,
} from '../model/applyOp';
import {
    currentAnalyses,
    entitiesNaming,
    guidedOrder,
    keepUnchanged,
    type CoordinateAnalysis,
    type CoordinateParse,
} from '../model/coordinates';
import { spansToUtf16, utf16Paper } from '../model/offsets';
import { mintLocalId } from '../model/mint';
import { randomUUID } from '../model/uuid';
import { entityPath, getIn, readPath, type Json } from '../model/paths';
import {
    buildRecordIndex,
    withSlotFrom,
    withSlotOrderOf,
    withSlotsSorted,
    type RecordIndex,
    type SlotNode,
    type SpanPair,
} from '../model/record';
import { entityKey, relationshipKey, slotTarget, targetKey } from '../model/targetKey';
import { addAnalysisPanel, coordinatePanelFor, focusedAnalysis } from '../coordinates/actions';
import { clamp, coordinateSpans, firstAnalysis, nextFocus } from '../coordinates/focus';
import { panelFor } from '../inspector/actions';
import { fromSchemaKeyed } from '../contract/schemas';
import { declaredAttributes } from '../inspector/schema';
import { STEPS, type StepId } from '../review/steps';
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

export interface Focus {
    entity: string;
    key: string;
    /** The slot the focus is on, or the reference slot holding the focused link. */
    slot?: string;
}

/** The focused coordinate analysis, by its key in the revision, its focused point and the points selected in it. */
export interface CoordinateFocus {
    analysis: string;
    point: number | null;
    selected: number[];
}

export interface Reveal {
    span: SpanPair;
    seq: number;
}

export type PanelKind =
    | 'edit'
    | 'not_reported'
    | 'reject'
    | 'note'
    | 'link'
    | 'delete'
    | 'create'
    | 'relabel'
    | 'edit_point'
    | 'add_point'
    | 'move'
    | 'merge'
    | 'add_analysis';

/** An inspector panel: what it acts on, the slot row it sits in when it is on a slot or link, and the table an analysis is added to. */
export interface Panel {
    kind: PanelKind;
    target: AnyTarget;
    slot?: string;
    table?: string;
}

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

export interface ReviewState {
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
    focus: Focus;
    focusedSpans: SpanPair[];
    evidenceCursor: number;
    reveal: Reveal | null;
    selection: SpanPair | null;
    step: StepId;
    outlineOpen: boolean;
    helpOpen: boolean;
    panel: Panel | null;
    /** The coordinate analysis in focus; null while a record item is. */
    coordinates: CoordinateFocus | null;
    /** The analyses selected for a merge. */
    merging: string[];
    showNonCoordinate: boolean;
    /** The record entity an added analysis made, offered for focus. */
    offer: { entity: string } | null;
    focusAnalysis(key: string, point?: number | null): void;
    movePoint(delta: 1 | -1): void;
    moveAnalysis(delta: 1 | -1): void;
    /** Selects or unselects a point of the focused analysis, the focused point by default. */
    togglePoint(index?: number): void;
    /** Selects or unselects an analysis for a merge, the focused one by default. */
    toggleMerge(key?: string): void;
    toggleNonCoordinate(): void;
    /** Opens the panel that adds an analysis to `table`. */
    addAnalysisTo(table: string): void;
    focusEntity(id: string): void;
    focusSlot(key: string): void;
    /** Focuses the link from the reference slot `slot` to the entity `target`. */
    focusLink(slot: string, target: string): void;
    moveSlot(delta: 1 | -1): void;
    moveEntity(delta: 1 | -1): void;
    stepEvidence(delta: 1 | -1): void;
    setSelection(selection: SpanPair | null): void;
    addEvidence(span: SpanPair, mode: EvidenceMode): boolean;
    /** Resolves once the local_id of a pending create_entity op is minted. */
    minted(clientOpId: string): Promise<void>;
    setStep(step: StepId): void;
    toggleOutline(open?: boolean): void;
    toggleHelp(open?: boolean): void;
    openPanel(kind: PanelKind): void;
    closePanel(): void;
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
    setLifecycle(state: ReviewLifecycle): void;
    dismissNotices(): void;
    /** Puts an op in pending: applied at once when it is local, held unapplied when the server applies it. */
    emit(op: Op): boolean;
    /** Puts the ops of one intent in pending as one batch, sent in one request whatever the save timing. */
    emitBatch(ops: Op[]): boolean;
    undoStack: UndoStep[];
    redoStack: UndoStep[];
    /** The undo or redo asked for while the step it takes was unconfirmed, run once the server confirms it. */
    waitingTo: 'undo' | 'redo' | null;
    /** Sends the inverse of the last user intent as one batch, and moves it to the redo stack. */
    undo(): void;
    /** Sends the inverse of the last undo as one batch, and moves it back to the undo stack. */
    redo(): void;
}

export type ReviewStore = ReturnType<typeof createReviewStore>;

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

function spansOf(index: RecordIndex, focus: Focus): SpanPair[] {
    return (index.slot(focus.key) ?? index.entity(focus.entity))?.spans ?? [];
}

/** The spans the focus highlights: the coordinate focus's while there is one, else the record item's. */
function spansNow(bundle: ReviewBundle, index: RecordIndex, focus: Focus, coordinates: CoordinateFocus | null) {
    return coordinates ? coordinateSpans(bundle, coordinates) : spansOf(index, focus);
}

export const selectFocusedSlot = (s: Pick<ReviewState, 'index' | 'focus'>): SlotNode | undefined =>
    s.index.slot(s.focus.key);

export const selectCanAddEvidence = (s: Pick<ReviewState, 'index' | 'focus'>): boolean => {
    const slot = selectFocusedSlot(s);
    return slot?.kind === 'value' && slot.value?.extraction_status === 'extracted';
};

export const selectIsBlocked = (s: Pick<ReviewState, 'blocked'>): boolean => s.blocked != null;

export const selectCanUndo = (s: Pick<ReviewState, 'blocked' | 'undoStack'>): boolean =>
    !selectIsBlocked(s) && s.undoStack.length > 0;

export const selectCanRedo = (s: Pick<ReviewState, 'blocked' | 'redoStack'>): boolean =>
    !selectIsBlocked(s) && s.redoStack.length > 0;

export function selectSaveLabel({
    save,
    saveMessage,
    pending,
    blocked,
}: Pick<ReviewState, 'save' | 'saveMessage' | 'pending' | 'blocked'>): string {
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
        coordinate_parse: spansToUtf16(text, bundle.coordinate_parse),
        coordinate_revision: spansToUtf16(text, bundle.coordinate_revision),
        review: bundle.review && { ...bundle.review, annotations: spansToUtf16(text, bundle.review.annotations) },
    };
};

const declaredIn = fromSchemaKeyed('extraction-record', (schema, schemaClass: string) =>
    declaredAttributes(schema, schemaClass).map(({ path, wrapper }) => ({ path, wrapper }))
);
/** The attributes a row's class declares, from the extraction record schema. */
const declaredOf = (row: { schema_class: string }) => declaredIn(row.schema_class);

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

function rebuiltIndex(bundle: ReviewBundle, record: Json, previous: RecordIndex, focus: Focus) {
    return withSlotOrderOf(buildRecordIndex({ ...bundle, record }, declaredOf), previous, focus.entity);
}

export interface ReviewStoreOptions {
    now?: () => string;
}

export function createReviewStore(
    loaded: ReviewBundle,
    { now = () => new Date().toISOString() }: ReviewStoreOptions = {}
) {
    const bundle = toDomBundle(loaded);
    const initialIndex = buildRecordIndex(bundle, declaredOf);
    const first = initialIndex.visible[0] ?? initialIndex.entities[0];
    const initial: Focus = { entity: first?.id ?? '', key: first ? entityKey(first.id) : '' };
    const initialCoordinates = STEPS[0].id === 'coordinates' ? firstAnalysis(currentAnalyses(bundle), false) : null;

    return createStore<ReviewState>()((set, get) => {
        let seq = 0;
        const revealed = (span: SpanPair | undefined, current: Reveal | null) =>
            span ? { span, seq: ++seq } : current;

        const focusOn = (focus: Focus) => {
            const { index, focus: previous, reveal } = get();
            const next = withSlotsSorted(index, previous.entity);
            const focusedSpans = spansOf(next, focus);
            set({
                focus,
                index: next,
                focusedSpans,
                evidenceCursor: 0,
                reveal: revealed(focusedSpans[0], reveal),
                panel: null,
                coordinates: null,
                offer: null,
            });
        };

        const focusCoordinates = (coordinates: CoordinateFocus | null) => {
            const { bundle: current, index, focus, reveal } = get();
            const focusedSpans = spansNow(current, index, focus, coordinates);
            set({
                coordinates,
                focusedSpans,
                evidenceCursor: 0,
                reveal: revealed(focusedSpans[0], reveal),
                panel: null,
            });
        };

        const guided = () => guidedOrder(currentAnalyses(get().bundle), get().showNonCoordinate);

        /** After the analyses change from `before`, focuses the one that replaced the focused one, or the one now in its place. */
        const refocusCoordinates = (before: CoordinateAnalysis[], sent: Op[]) => {
            const { coordinates, bundle: current, merging, showNonCoordinate } = get();
            const after = currentAnalyses(current);
            const keys = new Set(after.map((a) => a.key));
            set({ merging: merging.filter((k) => keys.has(k)) });
            if (!coordinates) return;
            const known = new Set(before.map((a) => a.key));
            const adding = sent.some((op) => op.type === 'coordinate' && op.action === 'add');
            const added = adding ? after.find((a) => !known.has(a.key) && !a.derived_from?.length) : undefined;
            const made = added && entitiesNaming(get().index, added.key)[0];
            if (made) set({ offer: { entity: made.id } });
            const next = nextFocus(before, after, coordinates, showNonCoordinate, added);
            if (!next) return focusCoordinates(null);
            if (next.analysis === coordinates.analysis) {
                return set({ coordinates: next, focusedSpans: coordinateSpans(current, next) });
            }
            focusCoordinates(next);
        };

        /** Focuses `created` once it is in the index, else the nearest ancestor of a focused entity that is gone. */
        const refocus = (rows: ReviewBundle['entities'], created?: string) => {
            const { index, focus, coordinates } = get();
            if (created && index.entity(created)) return focusOn({ entity: created, key: entityKey(created) });
            if (index.entity(focus.entity)) return;
            const parents = new Map(rows.map((r) => [r.local_id, r.parent]));
            let id = parents.get(focus.entity);
            while (id && !index.entity(id)) id = parents.get(id);
            const next = (id && index.entity(id)) || index.visible[0] || index.entities[0];
            if (!next) return;
            if (coordinates) set({ focus: { entity: next.id, key: entityKey(next.id) } });
            else focusOn({ entity: next.id, key: entityKey(next.id) });
        };

        const withDocuments = (
            next: ReviewBundle,
            pending: Op[],
            notices: Notice[] = [],
            touched: string[] | null = null,
            carry?: (record: Json, op: Op) => Op,
            answers = new Map<string, InverseOp[]>()
        ) => {
            const state = get();
            const replayed = replay(next, documentsOf(next), pending, now(), 'conflict', carry);
            const { record } = replayed.documents;
            const intents = Object.fromEntries(
                replayed.pending
                    .filter((op) => op.client_op_id in state.intents)
                    .map((op) => [op.client_op_id, state.intents[op.client_op_id]])
            );
            const sameView =
                JSON.stringify(next.hidden) === JSON.stringify(state.bundle.hidden) &&
                JSON.stringify(next.entities) === JSON.stringify(state.bundle.entities);
            const index =
                touched && sameView
                    ? touched.reduce((view, key) => withSlotFrom(view, record, key), state.index)
                    : rebuiltIndex(next, record, state.index, state.focus);
            const focusedSpans = spansNow(next, index, state.focus, state.coordinates);
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
                focusedSpans,
                evidenceCursor: clamp(state.evidenceCursor, Math.max(focusedSpans.length - 1, 0)),
                notices: [...state.notices, ...notices, ...replayed.notices],
                ...settled(
                    answerSteps({ undoStack: state.undoStack, redoStack: state.redoStack }, answers),
                    new Set(replayed.pending.map((op) => op.client_op_id)),
                    new Set(next.ops.map((s) => s.op.client_op_id))
                ),
            });
        };

        /**
         * Puts `ops` in pending as one batch, in the update that makes `also`: applied at once when none waits for
         * the server, else held unapplied. False, with a notice of `kind`, when the core refuses one.
         */
        const pushBatch = (ops: Op[], kind: Notice['kind'], also: Partial<ReviewState>): boolean => {
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
            const index = ops.reduce((view, op) => {
                const key = 'target' in op ? targetKey(op.target) : '';
                return key.startsWith('slot:') && !view.slot(key)
                    ? rebuiltIndex(state.bundle, documents.record, view, state.focus)
                    : withSlotFrom(view, documents.record, key);
            }, state.index);
            set({
                ...documents,
                index,
                focusedSpans: spansNow(state.bundle, index, state.focus, state.coordinates),
                pending,
                groupOf,
                ...also,
            });
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
            index: initialIndex,
            ops: bundle.ops,
            pending: [],
            groupOf: {},
            intents: {},
            blocked: null,
            save: 'idle',
            saveMessage: '',
            notices: [],
            focus: initial,
            focusedSpans: spansNow(bundle, initialIndex, initial, initialCoordinates),
            evidenceCursor: 0,
            reveal: null,
            selection: null,
            step: STEPS[0].id,
            outlineOpen: false,
            helpOpen: false,
            panel: null,
            coordinates: initialCoordinates,
            merging: [],
            showNonCoordinate: false,
            offer: null,
            undoStack: [],
            redoStack: [],
            waitingTo: null,

            focusAnalysis: (key, point = null) => {
                const { bundle: current, coordinates } = get();
                const analysis = currentAnalyses(current).find((a) => a.key === key);
                if (!analysis) return;
                const count = analysis.points?.length ?? 0;
                focusCoordinates({
                    analysis: key,
                    point: point !== null && point >= 0 && point < count ? point : null,
                    selected: coordinates?.analysis === key ? coordinates.selected : [],
                });
            },
            movePoint: (delta) => {
                const { coordinates, bundle: current } = get();
                const count = focusedAnalysis({ bundle: current, coordinates })?.points?.length ?? 0;
                if (!coordinates || count === 0) return;
                const at = coordinates.point;
                const next =
                    at === null ? (delta > 0 ? 0 : null) : at + delta < 0 ? null : Math.min(at + delta, count - 1);
                if (next !== at) focusCoordinates({ ...coordinates, point: next });
            },
            moveAnalysis: (delta) => {
                const order = guided();
                const at = order.findIndex((a) => a.key === get().coordinates?.analysis);
                const next = at === -1 ? 0 : clamp(at + delta, order.length - 1);
                if (order[next] && next !== at)
                    focusCoordinates({ analysis: order[next].key, point: null, selected: [] });
            },
            togglePoint: (index) => {
                const { coordinates } = get();
                const at = index ?? coordinates?.point ?? null;
                if (!coordinates) return;
                if (at === null) return get().toggleMerge();
                const selected = coordinates.selected.includes(at)
                    ? coordinates.selected.filter((i) => i !== at)
                    : [...coordinates.selected, at].sort((a, b) => a - b);
                set({ coordinates: { ...coordinates, selected } });
            },
            toggleMerge: (key) => {
                const { merging, coordinates } = get();
                const chosen = key ?? coordinates?.analysis;
                if (chosen === undefined) return;
                set({ merging: merging.includes(chosen) ? merging.filter((k) => k !== chosen) : [...merging, chosen] });
            },
            addAnalysisTo: (table) => set({ panel: addAnalysisPanel(table) }),
            toggleNonCoordinate: () => {
                const showNonCoordinate = !get().showNonCoordinate;
                set({ showNonCoordinate });
                const { coordinates } = get();
                if (coordinates && !guided().some((a) => a.key === coordinates.analysis)) {
                    focusCoordinates(firstAnalysis(currentAnalyses(get().bundle), showNonCoordinate));
                }
            },
            focusEntity: (id) => {
                if (get().index.entity(id)) focusOn({ entity: id, key: entityKey(id) });
            },
            focusSlot: (key) => {
                const slot = get().index.slot(key);
                if (slot) focusOn({ entity: slot.entity, key, slot: key });
            },
            focusLink: (slot, target) => {
                const node = get().index.slot(slot);
                if (node?.kind !== 'reference' || !node.references.includes(target)) return;
                const key = relationshipKey(node.entity, node.path, target);
                focusOn({ entity: node.entity, key, slot: node.key });
            },
            moveSlot: (delta) => {
                const { focus, index } = get();
                const slots = index.entity(focus.entity)?.slots ?? [];
                if (slots.length === 0) return;
                const at = slots.findIndex((s) => s.key === focus.key);
                const next = at === -1 ? (delta > 0 ? 0 : slots.length - 1) : clamp(at + delta, slots.length - 1);
                if (next !== at) focusOn({ entity: focus.entity, key: slots[next].key, slot: slots[next].key });
            },
            moveEntity: (delta) => {
                const { visible } = get().index;
                const at = visible.findIndex((e) => e.id === get().focus.entity);
                const next = at === -1 ? 0 : clamp(at + delta, visible.length - 1);
                if (visible[next] && next !== at)
                    focusOn({ entity: visible[next].id, key: entityKey(visible[next].id) });
            },
            stepEvidence: (delta) => {
                const { focusedSpans, evidenceCursor, reveal } = get();
                if (focusedSpans.length === 0) return;
                const cursor = (evidenceCursor + delta + focusedSpans.length) % focusedSpans.length;
                set({ evidenceCursor: cursor, reveal: revealed(focusedSpans[cursor], reveal) });
            },
            setSelection: (selection) => {
                const current = get().selection;
                if (selection?.[0] !== current?.[0] || selection?.[1] !== current?.[1]) set({ selection });
            },
            addEvidence: (span, mode) => {
                const state = get();
                const slot = selectFocusedSlot(state);
                if (!slot || !selectCanAddEvidence(state)) return false;
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
                set((s) => ({
                    intents: { ...s.intents, [op.client_op_id]: intent },
                    evidenceCursor: Math.max(
                        s.focusedSpans.findIndex(([start, end]) => start === span[0] && end === span[1]),
                        0
                    ),
                }));
                return true;
            },
            minted: (clientOpId) => mints.get(clientOpId) ?? Promise.resolve(),
            setStep: (step) => {
                set({ step });
                const { coordinates, bundle: current, showNonCoordinate } = get();
                if (step !== 'coordinates' && coordinates) focusCoordinates(null);
                if (step === 'coordinates' && !coordinates) {
                    const first = firstAnalysis(currentAnalyses(current), showNonCoordinate);
                    if (first) focusCoordinates(first);
                }
            },
            toggleOutline: (open) => set((s) => ({ outlineOpen: open ?? !s.outlineOpen })),
            toggleHelp: (open) => set((s) => ({ helpOpen: open ?? !s.helpOpen })),
            openPanel: (kind) => {
                const state = get();
                const panel = state.coordinates ? coordinatePanelFor(state, kind) : panelFor(state, kind);
                if (panel) set({ panel });
            },
            closePanel: () => set({ panel: null }),
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
                const { blocked, bundle, pending } = get();
                if (!blocked) return;
                const refused = new Set(blocked.clientOpIds);
                withDocuments(
                    bundle,
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
                    inverses
                );
                const created = sent.flatMap((op) =>
                    op.type === 'create_entity' && typeof (op.entity as Json).local_id === 'string'
                        ? [(op.entity as Json).local_id as string]
                        : []
                );
                refocus(current.entities, created.at(-1));
                refocusCoordinates(before, sent);
                const { waitingTo } = get();
                if (waitingTo) sendInverse(waitingTo);
            },
            rebase: (fresh) => {
                const stored = new Set(fresh.ops.map((s) => s.op.client_op_id));
                const { pending, intents, bundle: current } = get();
                const before = currentAnalyses(current);
                withDocuments(
                    toDomBundle(fresh),
                    pending.filter((op) => !stored.has(op.client_op_id)),
                    [],
                    null,
                    (record, op) => carried(record, op, intents[op.client_op_id])
                );
                refocus(current.entities);
                refocusCoordinates(before, []);
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
            setLifecycle: (state) => {
                const { bundle: current } = get();
                if (!current.review) return;
                set({ bundle: { ...current, review: { ...current.review, state } } });
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
