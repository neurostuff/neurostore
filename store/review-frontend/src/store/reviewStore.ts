import { createStore } from 'zustand';
import type { ReviewBundle, StoredOp } from '../contract/generated/review-bundle';
import type { Evidence, Op, SetEvidenceOp, Span } from '../contract/generated/review-ops';
import { applyOp } from '../model/applyOp';
import type { Json } from '../model/paths';
import {
    buildRecordIndex,
    withSlotFrom,
    withSlotsSorted,
    type RecordIndex,
    type SlotNode,
    type SpanPair,
} from '../model/record';
import { entityKey } from '../model/targetKey';
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

export interface ReviewState {
    bundle: ReviewBundle;
    record: Json;
    index: RecordIndex;
    ops: StoredOp[];
    pending: Op[];
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

function withSpan(evidence: Evidence | undefined, span: SpanPair, mode: EvidenceMode): Evidence {
    const sets = (evidence?.sets ?? []).map(withoutText);
    if (mode === 'new' || sets.length === 0) {
        return { ...evidence, status: 'present', sets: [...sets, { spans: [toSpan(span)] }] };
    }
    const [first, ...rest] = sets;
    return {
        ...evidence,
        status: 'present',
        sets: [{ ...first, spans: inReadingOrder([...first.spans, toSpan(span)]) }, ...rest],
    };
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

        return {
            bundle,
            record,
            index: initialIndex,
            ops: bundle.ops,
            pending: [],
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
                const op: SetEvidenceOp = {
                    client_op_id: crypto.randomUUID(),
                    type: 'set_evidence',
                    target: { kind: 'slot', entity: slot.entity, path: slot.path },
                    evidence: withSpan(slot.value?.evidence, span, mode),
                };
                const record = applyOp(state.record, op);
                const index = withSlotFrom(state.index, record, slot.key);
                const focusedSpans = spansOf(index, state.focus);
                set({
                    record,
                    index,
                    pending: [...state.pending, op],
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
        };
    });
}
