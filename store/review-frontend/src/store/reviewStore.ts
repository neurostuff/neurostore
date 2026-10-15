import { createStore } from 'zustand';
import type { OpResult, ReviewLifecycle } from '../api/reviewApi';
import type { ReviewBundle, StoredOp } from '../contract/generated/review-bundle';
import type { Evidence, Op, SetEvidenceOp, Span } from '../contract/generated/review-ops';
import { applyOp } from '../model/applyOp';
import { entityPath, getIn, parsePath, type Json } from '../model/paths';
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
    setStep(step: StepId): void;
    toggleOutline(open?: boolean): void;
    toggleHelp(open?: boolean): void;
    setSave(save: SaveStatus, message?: string): void;
    confirm(result: OpResult, sent: Op[]): void;
    rebase(fresh: ReviewBundle): void;
    refuse(refusals: Refusal[]): void;
    setLifecycle(state: ReviewLifecycle): void;
    dismissNotices(): void;
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
    const steps = [...(entityPath(record, op.target.entity) ?? []), ...parsePath(op.target.path)];
    const wrapper = getIn(record, steps) as { evidence?: Evidence } | undefined;
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

function replay(base: Json, ops: Op[]) {
    let record = base;
    const pending: Op[] = [];
    const notices: Notice[] = [];
    for (const op of ops) {
        try {
            record = applyOp(record, op);
            pending.push(op);
        } catch (error) {
            notices.push({ kind: 'conflict', slot: slotLabel(op), message: (error as Error).message });
        }
    }
    return { record, pending, notices };
}

export function createReviewStore(bundle: ReviewBundle) {
    const record = bundle.record as Json;
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
            touched: string[] | null = null
        ) => {
            const state = get();
            const replayed = replay(next.record as Json, pending);
            const intents = Object.fromEntries(
                replayed.pending
                    .filter((op) => op.client_op_id in state.intents)
                    .map((op) => [op.client_op_id, state.intents[op.client_op_id]])
            );
            const sameHidden = JSON.stringify(next.hidden) === JSON.stringify(state.bundle.hidden);
            const index =
                touched && sameHidden
                    ? touched.reduce((view, key) => withSlotFrom(view, replayed.record, key), state.index)
                    : withSlotOrderOf(
                          buildRecordIndex({ ...next, record: replayed.record }),
                          state.index,
                          state.focus.entity
                      );
            const focusedSpans = spansOf(index, state.focus);
            set({
                bundle: next,
                ops: next.ops,
                record: replayed.record,
                pending: replayed.pending,
                intents,
                index,
                focusedSpans,
                evidenceCursor: clamp(state.evidenceCursor, Math.max(focusedSpans.length - 1, 0)),
                notices: [...state.notices, ...notices, ...replayed.notices],
            });
        };

        return {
            bundle,
            record,
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
                const record = applyOp(state.record, op);
                const index = withSlotFrom(state.index, record, slot.key);
                const focusedSpans = spansOf(index, state.focus);
                set({
                    record,
                    index,
                    pending: [...state.pending, op],
                    intents: { ...state.intents, [op.client_op_id]: intent },
                    focusedSpans,
                    evidenceCursor: Math.max(
                        focusedSpans.findIndex(([s, e]) => s === span[0] && e === span[1]),
                        0
                    ),
                });
                return true;
            },
            setStep: (step) => set({ step }),
            toggleOutline: (open) => set((s) => ({ outlineOpen: open ?? !s.outlineOpen })),
            toggleHelp: (open) => set((s) => ({ helpOpen: open ?? !s.helpOpen })),
            setSave: (save, message = '') => set({ save, saveMessage: message }),
            confirm: (result, sent) => {
                const { bundle: current, ops, pending } = get();
                const sentIds = new Set(sent.map((op) => op.client_op_id));
                const seqs = new Set(ops.map((s) => s.seq));
                const review = current.review && {
                    ...current.review,
                    last_seq: result.last_seq,
                    provenance: result.provenance,
                    annotations: result.annotations,
                };
                const rest = pending.filter((op) => !sentIds.has(op.client_op_id));
                withDocuments(
                    {
                        ...current,
                        record: result.record,
                        coordinate_revision: result.coordinate_revision,
                        hidden: result.hidden,
                        review,
                        ops: [...ops, ...result.ops.filter((s) => !seqs.has(s.seq))],
                    },
                    rest,
                    [],
                    [...sent, ...rest].flatMap((op) => ('target' in op ? [targetKey(op.target)] : []))
                );
            },
            rebase: (fresh) => {
                const stored = new Set(fresh.ops.map((s) => s.op.client_op_id));
                const { pending, intents } = get();
                let record = fresh.record as Json;
                const rebased = pending
                    .filter((op) => !stored.has(op.client_op_id))
                    .map((op) => {
                        const next = carried(record, op, intents[op.client_op_id]);
                        record = replay(record, [next]).record;
                        return next;
                    });
                withDocuments(fresh, rebased);
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
        };
    });
}
