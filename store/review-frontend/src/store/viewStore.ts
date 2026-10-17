import { createStore } from 'zustand';
import type { ReviewBundle } from '../contract/generated/review-bundle';
import type { AnyTarget, Op } from '../contract/generated/review-ops';
import { clamp, firstAnalysis, focusedAnalysis, nextFocus, type CoordinateFocus } from '../model/coordinateFocus';
import { currentAnalyses, entitiesNaming, guidedOrder, type CoordinateAnalysis } from '../model/coordinates';
import { analysisItemFor, diffTarget, nextChange, resolveTarget, visibleItems } from '../model/diff';
import { stepCards } from '../model/guided';
import type { Json } from '../model/paths';
import type { RecordIndex, SpanPair } from '../model/record';
import { STEPS, type StepId } from '../model/steps';
import { entityKey, relationshipKey } from '../model/targetKey';
import { isFocused, selectDiff } from './diffSelectors';
import { selectIsEditable, type Replaced, type SessionStore } from './sessionStore';
import { selectEvidenceCursor, selectFocusedSpans, selectShown } from './viewSelectors';

export interface Focus {
    entity: string;
    key: string;
    /** The slot the focus is on, or the reference slot holding the focused link. */
    slot?: string;
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
    | 'add_analysis'
    | 'link_analysis'
    | 'merge_entity';

/** An inspector panel: what it acts on, the slot row it sits in when it is on a slot or link, and the table an analysis is added to. */
export interface Panel {
    kind: PanelKind;
    target: AnyTarget;
    slot?: string;
    table?: string;
}

export type OutlineFilter = 'all' | 'unreviewed' | 'changed' | 'noted' | 'doubtful';

export interface ViewState {
    focus: Focus;
    /** The focused entity's slots as they were ordered when the focus landed, kept until it moves. */
    slotOrder: string[];
    /** The focused span, as stepped to; read through `selectEvidenceCursor`, which keeps it within the spans. */
    evidenceCursor: number;
    reveal: Reveal | null;
    selection: SpanPair | null;
    step: StepId;
    outlineOpen: boolean;
    /** The outline's filter for this session; in memory only, not saved. */
    outlineFilter: OutlineFilter;
    helpOpen: boolean;
    paletteOpen: boolean;
    /** Whether every evidence span of the paper is filled, not only underlined. */
    showAllEvidence: boolean;
    panel: Panel | null;
    /** The coordinate analysis in focus; null while a record item is. */
    coordinates: CoordinateFocus | null;
    /** The analyses selected for a merge. */
    merging: string[];
    showNonCoordinate: boolean;
    /** Whether the diff against the original is shown. */
    diffOn: boolean;
    /** The record entity an added analysis made, offered for focus. */
    offer: { entity: string } | null;
    toggleDiff(on?: boolean): void;
    /** Focuses the next or previous changed item of the diff. */
    moveChange(delta: 1 | -1): void;
    /** Focuses a slot, entity, link or coordinate analysis; false when the review has no such item. */
    focusTarget(target: AnyTarget): boolean;
    focusAnalysis(key: string, point?: number | null): void;
    movePoint(delta: 1 | -1): void;
    moveAnalysis(delta: 1 | -1): void;
    /** Selects or unselects a point of the focused analysis, the focused point by default. */
    togglePoint(index?: number): void;
    /** Selects or unselects an analysis for a merge, the focused one by default. */
    toggleMerge(key?: string): void;
    toggleNonCoordinate(): void;
    focusEntity(id: string): void;
    focusSlot(key: string): void;
    /** Focuses the link from the reference slot `slot` to the entity `target`. */
    focusLink(slot: string, target: string): void;
    moveSlot(delta: 1 | -1): void;
    moveEntity(delta: 1 | -1): void;
    stepEvidence(delta: 1 | -1): void;
    /** Puts the evidence cursor on `span`, once it is among the focused spans. */
    showSpan(span: SpanPair): void;
    setSelection(selection: SpanPair | null): void;
    setStep(step: StepId): void;
    /** Goes to the next or previous guided step, stopping at the ends. */
    moveStep(delta: 1 | -1): void;
    toggleOutline(open?: boolean): void;
    setOutlineFilter(filter: OutlineFilter): void;
    toggleHelp(open?: boolean): void;
    toggleAllEvidence(on?: boolean): void;
    togglePalette(open?: boolean): void;
    /** Scrolls the text to `span`, as a focus does, without focusing anything. */
    revealSpan(span: SpanPair): void;
    openPanel(panel: Panel): void;
    closePanel(): void;
}

export type ViewStore = ReturnType<typeof createViewStore>;

/** The position `delta` from `at` in a list of `length`, kept within it; `start` when `at` is in none of it. */
const stepIn = (length: number, at: number, delta: number, start = 0) =>
    at === -1 ? start : clamp(at + delta, length - 1);

const slotKeysOf = (index: RecordIndex, entity: string) => index.entity(entity)?.slots.map((s) => s.key) ?? [];

const createdBy = (sent: Op[]) =>
    sent.flatMap((op) =>
        op.type === 'create_entity' && typeof (op.entity as Json).local_id === 'string'
            ? [(op.entity as Json).local_id as string]
            : []
    );

/** The entity of `id` in `index`, else of its nearest ancestor there by `rows`. */
function nearest(index: RecordIndex, rows: ReviewBundle['entities'], id: string) {
    const parents = new Map(rows.map((r) => [r.local_id, r.parent]));
    let at: string | null | undefined = id;
    while (at && !index.entity(at)) at = parents.get(at);
    return at ? index.entity(at) : undefined;
}

/** What one reviewer is looking at in `session`: it reads the documents, and follows the ones a confirm or rebase replaces. */
export function createViewStore(session: SessionStore) {
    const documents = () => session.getState();
    const { bundle, index } = documents();
    const first = index.visible[0] ?? index.entities[0];
    const initial: Focus = { entity: first?.id ?? '', key: first ? entityKey(first.id) : '' };
    const initialCoordinates = STEPS[0].id === 'coordinates' ? firstAnalysis(currentAnalyses(bundle), false) : null;

    return createStore<ViewState>()((set, get) => {
        let seq = 0;
        const revealed = (span: SpanPair | undefined, current: Reveal | null) =>
            span ? { span, seq: ++seq } : current;
        const shown = () => selectShown(documents(), get());
        const spans = () => selectFocusedSpans(documents(), get());

        const landed = (focus: Focus) => ({ focus, slotOrder: slotKeysOf(documents().index, focus.entity) });

        const focusOn = (focus: Focus) => {
            const { reveal } = get();
            const focused = selectFocusedSpans(documents(), { focus, coordinates: null });
            set({
                ...landed(focus),
                evidenceCursor: 0,
                reveal: revealed(focused[0], reveal),
                panel: null,
                coordinates: null,
                offer: null,
            });
        };

        const focusCoordinates = (coordinates: CoordinateFocus | null) => {
            const { focus, reveal } = get();
            const focused = selectFocusedSpans(documents(), { focus, coordinates });
            set({ coordinates, evidenceCursor: 0, reveal: revealed(focused[0], reveal), panel: null });
        };

        const guided = () => guidedOrder(currentAnalyses(documents().bundle), get().showNonCoordinate);

        const pruneMerging = () => {
            const keys = new Set(currentAnalyses(documents().bundle).map((a) => a.key));
            const { merging } = get();
            if (merging.some((k) => !keys.has(k))) set({ merging: merging.filter((k) => keys.has(k)) });
        };

        /** The analysis an add in `sent` made, and the record entity naming it, offered for focus. */
        const offerAdded = (before: CoordinateAnalysis[], sent: Op[]) => {
            if (!sent.some((op) => op.type === 'coordinate' && op.action === 'add')) return undefined;
            const known = new Set(before.map((a) => a.key));
            const added = currentAnalyses(documents().bundle).find((a) => !known.has(a.key) && !a.derived_from?.length);
            const made = added && entitiesNaming(documents().index, added.key)[0];
            if (made) set({ offer: { entity: made.id } });
            return added;
        };

        /** After the analyses change from `before`, focuses `added`, the one that replaced the focused one, or the one now in its place. */
        const refocusCoordinates = (before: CoordinateAnalysis[], added: CoordinateAnalysis | undefined) => {
            const { coordinates, showNonCoordinate } = get();
            if (!coordinates) return;
            const next = nextFocus(before, currentAnalyses(documents().bundle), coordinates, showNonCoordinate, added);
            if (next?.analysis === coordinates.analysis) return set({ coordinates: next });
            focusCoordinates(next);
        };

        /** Focuses `created` once it is in the index, else the nearest ancestor of a focused entity that is gone. */
        const refocusEntity = (rows: ReviewBundle['entities'], created?: string) => {
            const { focus, coordinates } = get();
            const listed = shown();
            const made = created ? listed.entity(created) : undefined;
            if (!made && listed.entity(focus.entity)) return;
            const next = made ?? nearest(listed, rows, focus.entity) ?? listed.visible[0] ?? listed.entities[0];
            if (!next) return;
            const target = { entity: next.id, key: entityKey(next.id) };
            if (coordinates && !made) set(landed(target));
            else focusOn(target);
        };

        const refocus = ({ before, sent }: Replaced) => {
            refocusEntity(before.entities, createdBy(sent).at(-1));
            pruneMerging();
            const analyses = currentAnalyses(before);
            if (get().coordinates) refocusCoordinates(analyses, offerAdded(analyses, sent));
        };

        session.subscribe((state, previous) => {
            if (state.replaced && state.replaced !== previous.replaced) refocus(state.replaced);
        });

        return {
            ...landed(initial),
            evidenceCursor: 0,
            reveal: null,
            selection: null,
            step: STEPS[0].id,
            outlineOpen: false,
            outlineFilter: 'all',
            helpOpen: false,
            paletteOpen: false,
            showAllEvidence: false,
            panel: null,
            coordinates: initialCoordinates,
            merging: [],
            showNonCoordinate: false,
            diffOn: false,
            offer: null,

            focusAnalysis: (key, point = null) => {
                const { coordinates } = get();
                const analysis = currentAnalyses(documents().bundle).find((a) => a.key === key);
                if (!analysis) return;
                const count = analysis.points?.length ?? 0;
                focusCoordinates({
                    analysis: key,
                    point: point !== null && point >= 0 && point < count ? point : null,
                    selected: coordinates?.analysis === key ? coordinates.selected : [],
                });
            },
            movePoint: (delta) => {
                const { coordinates } = get();
                const count = focusedAnalysis({ bundle: documents().bundle, coordinates })?.points?.length ?? 0;
                if (!coordinates || count === 0) return;
                const at = coordinates.point;
                const next =
                    at === null ? (delta > 0 ? 0 : null) : at + delta < 0 ? null : Math.min(at + delta, count - 1);
                if (next !== at) focusCoordinates({ ...coordinates, point: next });
            },
            moveAnalysis: (delta) => {
                const order = guided();
                const at = order.findIndex((a) => a.key === get().coordinates?.analysis);
                const next = stepIn(order.length, at, delta);
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
            toggleNonCoordinate: () => {
                const showNonCoordinate = !get().showNonCoordinate;
                set({ showNonCoordinate });
                const { coordinates } = get();
                if (coordinates && !guided().some((a) => a.key === coordinates.analysis)) {
                    focusCoordinates(firstAnalysis(currentAnalyses(documents().bundle), showNonCoordinate));
                }
            },
            focusEntity: (id) => {
                if (documents().index.entity(id)) focusOn({ entity: id, key: entityKey(id) });
            },
            focusSlot: (key) => {
                const slot = documents().index.slot(key);
                if (slot) focusOn({ entity: slot.entity, key, slot: key });
            },
            focusLink: (slot, target) => {
                const node = documents().index.slot(slot);
                if (node?.kind !== 'reference' || !node.references.includes(target)) return;
                const key = relationshipKey(node.entity, node.path, target);
                focusOn({ entity: node.entity, key, slot: node.key });
            },
            moveSlot: (delta) => {
                const { focus } = get();
                const slots = shown().entity(focus.entity)?.slots ?? [];
                const at = slots.findIndex((s) => s.key === focus.key);
                const next = stepIn(slots.length, at, delta, delta > 0 ? 0 : slots.length - 1);
                if (slots[next] && next !== at)
                    focusOn({ entity: focus.entity, key: slots[next].key, slot: slots[next].key });
            },
            moveEntity: (delta) => {
                const listed = shown();
                const cards = stepCards({ index: listed, step: get().step }) ?? listed.visible;
                const at = cards.findIndex((e) => e.id === get().focus.entity);
                const next = stepIn(cards.length, at, delta);
                if (cards[next] && next !== at) focusOn({ entity: cards[next].id, key: entityKey(cards[next].id) });
            },
            stepEvidence: (delta) => {
                const focused = spans();
                if (focused.length === 0) return;
                const at = selectEvidenceCursor(documents(), get());
                const cursor = (at + delta + focused.length) % focused.length;
                set((s) => ({ evidenceCursor: cursor, reveal: revealed(focused[cursor], s.reveal) }));
            },
            showSpan: (span) => {
                const at = spans().findIndex(([start, end]) => start === span[0] && end === span[1]);
                set({ evidenceCursor: Math.max(at, 0) });
            },
            setSelection: (selection) => {
                const current = get().selection;
                if (selection?.[0] !== current?.[0] || selection?.[1] !== current?.[1]) set({ selection });
            },
            setStep: (step) => {
                set({ step });
                const { coordinates, showNonCoordinate } = get();
                if (step !== 'coordinates' && coordinates) focusCoordinates(null);
                if (step === 'coordinates' && !coordinates) {
                    const first = firstAnalysis(currentAnalyses(documents().bundle), showNonCoordinate);
                    if (first) focusCoordinates(first);
                }
                const cards = stepCards({ index: shown(), step });
                if (cards?.length && !cards.some((e) => e.id === get().focus.entity)) {
                    focusOn({ entity: cards[0].id, key: entityKey(cards[0].id) });
                }
            },
            moveStep: (delta) => {
                const at = STEPS.findIndex((step) => step.id === get().step);
                const next = STEPS[stepIn(STEPS.length, at, delta)].id;
                if (next !== get().step) get().setStep(next);
            },
            toggleDiff: (on) => set((s) => ({ diffOn: on ?? !s.diffOn })),
            moveChange: (delta) => {
                const state = get();
                const current = documents();
                const diff = selectDiff(current);
                const focused = state.coordinates?.analysis;
                const next = nextChange(
                    visibleItems(diff, state.showNonCoordinate),
                    state.focus.key,
                    focused ? analysisItemFor(diff, focused) : undefined,
                    delta,
                    (item) => {
                        const target = diffTarget(item);
                        const intent = target && resolveTarget(current.index, current.bundle, target);
                        return !!intent && !isFocused(state, intent);
                    }
                );
                const target = next && diffTarget(next);
                if (target) get().focusTarget(target);
            },
            focusTarget: (target) => {
                const intent = resolveTarget(documents().index, documents().bundle, target);
                if (!intent) return false;
                switch (intent.kind) {
                    case 'slot':
                        get().focusSlot(intent.key);
                        break;
                    case 'entity':
                        get().focusEntity(intent.entity);
                        break;
                    case 'link':
                        get().focusLink(intent.slot, intent.target);
                        break;
                    case 'analysis':
                        get().focusAnalysis(intent.key);
                        break;
                }
                return true;
            },
            toggleOutline: (open) => set((s) => ({ outlineOpen: open ?? !s.outlineOpen })),
            setOutlineFilter: (outlineFilter) => set({ outlineFilter }),
            toggleHelp: (open) => set((s) => ({ helpOpen: open ?? !s.helpOpen })),
            toggleAllEvidence: (on) => set((s) => ({ showAllEvidence: on ?? !s.showAllEvidence })),
            togglePalette: (open) => set((s) => ({ paletteOpen: open ?? !s.paletteOpen })),
            revealSpan: (span) => set((s) => ({ reveal: revealed(span, s.reveal) })),
            openPanel: (panel) => {
                if (selectIsEditable(documents())) set({ panel });
            },
            closePanel: () => set({ panel: null }),
        };
    });
}
