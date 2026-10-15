import { createStore } from 'zustand';
import type { OpResult, ReviewLifecycle } from '../api/reviewApi';
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
import type { CoordinateParse } from '../model/coordinates';
import { spansToUtf16, utf16Paper } from '../model/offsets';
import { mintLocalId } from '../model/mint';
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
import { entityKey, targetKey } from '../model/targetKey';
import { STEPS, type StepId } from '../review/steps';

export type EvidenceMode = 'first' | 'new';

export interface Focus {
    entity: string;
    key: string;
}

export interface Reveal {
    span: SpanPair;
    seq: number;
}

export type SaveStatus = 'idle' | 'saving' | 'offline' | 'closed' | 'signin' | 'failed';

export interface Notice {
    kind: 'conflict' | 'refused';
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
    intents: Record<string, EvidenceIntent>;
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
    focusEntity(id: string): void;
    focusSlot(key: string): void;
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
    setSave(save: SaveStatus, message?: string): void;
    confirm(result: OpResult, sent: Op[]): void;
    rebase(fresh: ReviewBundle): void;
    refuse(refusals: Refusal[]): void;
    setLifecycle(state: ReviewLifecycle): void;
    dismissNotices(): void;
    /** Puts an op in pending: applied at once when it is local, held unapplied when the server applies it. */
    emit(op: Op): boolean;
}

export type ReviewStore = ReturnType<typeof createReviewStore>;

type EvidenceSet = NonNullable<Evidence['sets']>[number];

const clamp = (value: number, max: number) => Math.min(Math.max(value, 0), max);
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

export const selectFocusedSlot = (s: Pick<ReviewState, 'index' | 'focus'>): SlotNode | undefined =>
    s.index.slot(s.focus.key);

export const selectCanAddEvidence = (s: Pick<ReviewState, 'index' | 'focus'>): boolean => {
    const slot = selectFocusedSlot(s);
    return slot?.kind === 'value' && slot.value?.extraction_status === 'extracted';
};

export function selectSaveLabel({
    save,
    saveMessage,
    pending,
}: Pick<ReviewState, 'save' | 'saveMessage' | 'pending'>): string {
    if (save === 'failed') return saveMessage;
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
        review: bundle.review && { ...bundle.review, annotations: spansToUtf16(text, bundle.review.annotations) },
    };
};

const paperOf = (bundle: ReviewBundle, at: string): Paper => ({
    text: utf16Paper(bundle.text),
    userId: bundle.review?.user_id ?? '',
    at,
    coordinateParse: bundle.coordinate_parse as CoordinateParse,
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

function rebuiltIndex(bundle: ReviewBundle, record: Json, previous: RecordIndex, focus: Focus) {
    return withSlotOrderOf(buildRecordIndex({ ...bundle, record }), previous, focus.entity);
}

export interface ReviewStoreOptions {
    now?: () => string;
}

export function createReviewStore(
    loaded: ReviewBundle,
    { now = () => new Date().toISOString() }: ReviewStoreOptions = {}
) {
    const bundle = toDomBundle(loaded);
    const initialIndex = buildRecordIndex(bundle);
    const first = initialIndex.visible[0] ?? initialIndex.entities[0];
    const initial: Focus = { entity: first?.id ?? '', key: first ? entityKey(first.id) : '' };

    return createStore<ReviewState>()((set, get) => {
        let seq = 0;
        const revealed = (span: SpanPair | undefined, current: Reveal | null) =>
            span ? { span, seq: ++seq } : current;

        const focusOn = (focus: Focus) => {
            const { index, focus: previous, reveal } = get();
            const next = withSlotsSorted(index, previous.entity);
            const focusedSpans = spansOf(next, focus);
            set({ focus, index: next, focusedSpans, evidenceCursor: 0, reveal: revealed(focusedSpans[0], reveal) });
        };

        const withDocuments = (
            next: ReviewBundle,
            pending: Op[],
            notices: Notice[] = [],
            touched: string[] | null = null,
            carry?: (record: Json, op: Op) => Op
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
            const focusedSpans = spansOf(index, state.focus);
            set({
                bundle: next,
                ops: next.ops,
                ...replayed.documents,
                pending: replayed.pending,
                intents,
                index,
                focusedSpans,
                evidenceCursor: clamp(state.evidenceCursor, Math.max(focusedSpans.length - 1, 0)),
                notices: [...state.notices, ...notices, ...replayed.notices],
            });
        };

        /** Puts `op` in pending, applied at once unless it waits for the server; false when the core refuses it. */
        const push = (op: Op, extra?: (state: ReviewState) => Partial<ReviewState>): boolean => {
            const state = get();
            if (waits(state.pending, op)) {
                set({ pending: [...state.pending, op] });
            } else {
                const replayed = replay(state.bundle, state, [op], now(), 'refused');
                if (replayed.notices.length > 0) {
                    set({ notices: [...state.notices, ...replayed.notices] });
                    return false;
                }
                const { documents } = replayed;
                const key = 'target' in op ? targetKey(op.target) : '';
                const index =
                    key.startsWith('slot:') && !state.index.slot(key)
                        ? rebuiltIndex(state.bundle, documents.record, state.index, state.focus)
                        : withSlotFrom(state.index, documents.record, key);
                set({
                    ...documents,
                    index,
                    focusedSpans: spansOf(index, state.focus),
                    pending: [...state.pending, op],
                });
            }
            if (extra) set(extra(get()));
            return true;
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
            intents: {},
            save: 'idle',
            saveMessage: '',
            notices: [],
            focus: initial,
            focusedSpans: spansOf(initialIndex, initial),
            evidenceCursor: 0,
            reveal: null,
            selection: null,
            step: STEPS[0].id,
            outlineOpen: false,
            helpOpen: false,

            focusEntity: (id) => {
                if (get().index.entity(id)) focusOn({ entity: id, key: entityKey(id) });
            },
            focusSlot: (key) => {
                const slot = get().index.slot(key);
                if (slot) focusOn({ entity: slot.entity, key });
            },
            moveSlot: (delta) => {
                const { focus, index } = get();
                const slots = index.entity(focus.entity)?.slots ?? [];
                if (slots.length === 0) return;
                const at = slots.findIndex((s) => s.key === focus.key);
                const next = at === -1 ? (delta > 0 ? 0 : slots.length - 1) : clamp(at + delta, slots.length - 1);
                if (next !== at) focusOn({ entity: focus.entity, key: slots[next].key });
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
                    client_op_id: crypto.randomUUID(),
                    type: 'set_evidence',
                    target: { kind: 'slot', entity: slot.entity, path: slot.path },
                    evidence: withSpan(slot.value?.evidence, intent.span, intent.set_index),
                };
                return push(op, (s) => ({
                    intents: { ...s.intents, [op.client_op_id]: intent },
                    evidenceCursor: Math.max(
                        s.focusedSpans.findIndex(([start, end]) => start === span[0] && end === span[1]),
                        0
                    ),
                }));
            },
            minted: (clientOpId) => mints.get(clientOpId) ?? Promise.resolve(),
            setStep: (step) => set({ step }),
            toggleOutline: (open) => set((s) => ({ outlineOpen: open ?? !s.outlineOpen })),
            toggleHelp: (open) => set((s) => ({ helpOpen: open ?? !s.helpOpen })),
            setSave: (save, message = '') => set({ save, saveMessage: message }),
            confirm: (result, sent) => {
                const { bundle: current, ops, pending } = get();
                const sentIds = new Set(sent.map((op) => op.client_op_id));
                const seqs = new Set(ops.map((s) => s.seq));
                const dom = spansToUtf16(current.text, { record: result.record, annotations: result.annotations });
                const review = current.review && {
                    ...current.review,
                    last_seq: result.last_seq,
                    provenance: result.provenance,
                    annotations: dom.annotations,
                };
                const rest = pending.filter((op) => !sentIds.has(op.client_op_id));
                const touched = [...sent, ...rest].flatMap((op) => ('target' in op ? [targetKey(op.target)] : []));
                withDocuments(
                    {
                        ...current,
                        record: dom.record,
                        coordinate_revision: result.coordinate_revision,
                        hidden: result.hidden,
                        entities: (result.entities as ReviewBundle['entities'] | undefined) ?? current.entities,
                        review,
                        ops: [...ops, ...result.ops.filter((s) => !seqs.has(s.seq))],
                    },
                    rest,
                    [],
                    sent.every(isLocalOp) ? touched : null
                );
            },
            rebase: (fresh) => {
                const stored = new Set(fresh.ops.map((s) => s.op.client_op_id));
                const { pending, intents } = get();
                withDocuments(
                    toDomBundle(fresh),
                    pending.filter((op) => !stored.has(op.client_op_id)),
                    [],
                    null,
                    (record, op) => carried(record, op, intents[op.client_op_id])
                );
            },
            refuse: (refusals) => {
                const refused = new Set(refusals.map((r) => r.op.client_op_id));
                withDocuments(
                    get().bundle,
                    get().pending.filter((op) => !refused.has(op.client_op_id)),
                    refusals.map(({ op, message }) => ({ kind: 'refused', slot: slotLabel(op), message }))
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
                return push(op);
            },
        };
    });
}
