import { createStore } from 'zustand';
import type { ReviewBundle } from '../contract/generated/review-bundle';
import type { AnyTarget, Op } from '../contract/generated/review-ops';
import {
    clamp,
    firstAnalysis,
    focusedAnalysis,
    guidedIndex,
    placeReveal,
    nextFocus,
    tableReveal,
    type CoordinateFocus,
} from '../model/coordinateFocus';
import { currentAnalyses, entitiesNaming, guidedOrder, hasPoints, type CoordinateAnalysis } from '../model/coordinates';
import { randomUUID } from '../model/uuid';
import { analysisItemFor, diffTarget, nextChange, resolveTarget, visibleItems } from '../model/diff';
import { auditRows, isLinkStep, stepCards, type AuditLink } from '../model/guided';
import type { Json } from '../model/paths';
import type { RecordIndex, SpanPair } from '../model/record';
import { STEPS, type StepId } from '../model/steps';
import { analysisTarget, entityKey, relationshipKey, slotTarget, targetKey } from '../model/targetKey';
import { isFocused, selectDiff } from './diffSelectors';
import { followerOf, type Follower } from '../model/analysisFollow';
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
    | 'edit_analysis'
    | 'relabel'
    | 'move'
    | 'merge'
    | 'add_analysis'
    | 'link_analysis'
    | 'merge_entity'
    | 'accept_card'
    | 'move_evidence';

/**
 * An inspector panel: what it acts on, the slot row it sits in when it is on a slot or link, and the table, or the
 * span of the text, an analysis is added from.
 */
export interface Panel {
    kind: PanelKind;
    target: AnyTarget;
    slot?: string;
    table?: string;
    span?: SpanPair;
}

/**
 * What one accept of the card `card` took: its entity or not, how many fields, and the unjudged ones without evidence
 * left; on step 5, how many links.
 */
export interface AcceptedCard {
    card: string;
    entity: boolean;
    fields: number;
    withoutEvidenceLeft: number;
    links: number;
}

/** A verdict the reviewer gave a coordinate analysis. */
export interface JudgedAnalysis {
    analysis: string;
    verdict: 'accept' | 'reject';
}

export type OutlineFilter = 'all' | 'unreviewed' | 'changed' | 'noted' | 'doubtful';

export interface ViewState {
    focus: Focus;
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
    /** The last card accept on the focused card, until the focus moves. */
    accepted: AcceptedCard | null;
    showAccepted(accepted: AcceptedCard): void;
    /** The reviewer's last verdict on the focused coordinate analysis, until the focus moves to another. */
    judged: JudgedAnalysis | null;
    showJudged(judged: JudgedAnalysis): void;
    /** Gives the record entity the add `clientOpId` makes the slot values `values`, once the server has made it. */
    setOnMade(clientOpId: string, values: Record<string, string>): void;
    /**
     * The id of the reviewer's last ask for the focused analysis's point grid, in place of its static table; null
     * while the table is static. Focusing another analysis makes it static again. Ids never repeat in a review.
     */
    gridEngagement: number | null;
    /** Asks for the point grid, and gives the ask's id. */
    engageGrid(): number;
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
    /** Makes `selected` the selected points of the focused analysis. */
    selectPoints(selected: number[]): void;
    /** Selects or unselects an analysis for a merge, the focused one by default. */
    toggleMerge(key?: string): void;
    toggleNonCoordinate(): void;
    focusEntity(id: string): void;
    focusSlot(key: string): void;
    /** Focuses the link from the reference slot `slot` to the entity `target`. */
    focusLink(slot: string, target: string): void;
    moveSlot(delta: 1 | -1): void;
    moveEntity(delta: 1 | -1): void;
    /**
     * Focuses the step's next card after the focused one, round to its start, that is not hidden and no one has
     * judged; on the coordinates step, the next such analysis.
     */
    focusNextUnjudged(): void;
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

/** The first item of `list` from `start` on, round to its start, that `keep` takes. */
const nextRound = <T>(list: T[], start: number, keep: (item: T) => boolean) =>
    list.map((_, i) => list[(start + i) % list.length]).find(keep);

/** The position `delta` from `at` in a list of `length`, kept within it; `start` when `at` is in none of it. */
const stepIn = (length: number, at: number, delta: number, start = 0) =>
    at === -1 ? start : clamp(at + delta, length - 1);

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
        let engagements = 0;
        const revealed = (span: SpanPair | undefined, current: Reveal | null) =>
            span ? { span, seq: ++seq } : current;
        /** The coordinate focus the step had when the review last left it. */
        let left: CoordinateFocus | null = null;
        const shownAt = (coordinates: CoordinateFocus | null) =>
            coordinates
                ? (selectFocusedSpans(documents(), { focus: initial, coordinates })[0] ??
                  placeReveal(documents().bundle, coordinates.analysis))
                : undefined;
        const shown = () => selectShown(documents(), get());
        const shownDocuments = () => ({ index: shown(), bundle: documents().bundle });
        const spans = () => selectFocusedSpans(documents(), get());

        const focusOn = (focus: Focus) => {
            const { reveal } = get();
            if (get().coordinates) session.getState().askToSend();
            const focused = selectFocusedSpans(documents(), { focus, coordinates: null });
            const table = focus.slot
                ? undefined
                : tableReveal(documents().bundle, documents().index.entity(focus.entity));
            set({
                focus,
                evidenceCursor: 0,
                reveal: revealed(focused[0] ?? table, reveal),
                panel: null,
                coordinates: null,
                offer: null,
                accepted: null,
                judged: null,
            });
        };

        /**
         * Focuses `coordinates`; the point grid stays engaged on the same analysis, or on the one `kept` replaced.
         * Leaving an analysis sends the point edits collected.
         */
        const focusCoordinates = (coordinates: CoordinateFocus | null, kept = false) => {
            const { reveal, gridEngagement, judged } = get();
            const same = kept || coordinates?.analysis === get().coordinates?.analysis;
            if (!same) session.getState().askToSend();
            set({
                coordinates,
                evidenceCursor: 0,
                reveal: revealed(shownAt(coordinates), reveal),
                panel: null,
                gridEngagement: same ? gridEngagement : null,
                judged: judged?.analysis === coordinates?.analysis ? judged : null,
            });
        };

        const guided = () => guidedOrder(currentAnalyses(documents().bundle), get().showNonCoordinate);

        const pruneMerging = () => {
            const keys = new Set(currentAnalyses(documents().bundle).map((a) => a.key));
            const { merging } = get();
            if (merging.some((k) => !keys.has(k))) set({ merging: merging.filter((k) => keys.has(k)) });
        };

        /** The slot values each add, by client_op_id, gives the record entity it makes. */
        const onMade = new Map<string, Record<string, string>>();

        /** Sets the values an add asked for on the record entity it made, as one batch. */
        const fillMade = (entity: string, values: Record<string, string>) => {
            const ops = Object.entries(values).map(([path, value]): Op => ({
                client_op_id: randomUUID(),
                type: 'set_value',
                target: slotTarget(entity, path),
                value: { extraction_status: 'extracted', value, value_source: 'reported' },
            }));
            session.getState().emitBatch(ops);
        };

        /**
         * The analysis an add in `sent` made, shown even when it has no points, and the record entity naming it,
         * offered for focus and given the values the add asked for.
         */
        const offerAdded = (before: CoordinateAnalysis[], sent: Op[]) => {
            const add = sent.find((op) => op.type === 'coordinate' && op.action === 'add');
            if (!add) return undefined;
            const known = new Set(before.map((a) => a.key));
            const added = currentAnalyses(documents().bundle).find((a) => !known.has(a.key) && !a.derived_from?.length);
            if (added && !hasPoints(added) && !get().showNonCoordinate) set({ showNonCoordinate: true });
            const made = added && entitiesNaming(documents().index, added.key)[0];
            if (made) set({ offer: { entity: made.id } });
            const values = onMade.get(add.client_op_id);
            onMade.delete(add.client_op_id);
            if (made && values) fillMade(made.id, values);
            return added;
        };

        /** After the analyses change, focuses `added`, the one that replaced the focused one, or the one now in its place. */
        const refocusCoordinates = (follower: Follower, added: CoordinateAnalysis | undefined) => {
            const { coordinates, showNonCoordinate } = get();
            if (!coordinates) return;
            const next = nextFocus(
                follower.was,
                follower.now,
                coordinates,
                showNonCoordinate,
                added,
                follower.successor
            );
            if (next?.analysis === coordinates.analysis) return set({ coordinates: next });
            focusCoordinates(next, !added && next?.analysis === follower.successor(coordinates.analysis));
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
            if (coordinates && !made) set({ focus: target });
            else focusOn(target);
        };

        const refocus = ({ before, sent }: Replaced) => {
            refocusEntity(before.entities, createdBy(sent).at(-1));
            pruneMerging();
            if (!get().coordinates) return;
            const follower = followerOf(before, documents().bundle);
            refocusCoordinates(follower, offerAdded(follower.was, sent));
        };

        /** Step 5's link rows, and where the focus is among them: on a row, else before the focused card's first. */
        const linkRows = () => {
            const rows = auditRows(shownDocuments());
            const { focus } = get();
            const on = rows.findIndex((row) => row.key === focus.key);
            if (on !== -1) return { rows, on, before: on };
            const cards = stepCards({ ...shownDocuments(), step: 'relationships' }) ?? [];
            const card = cards.findIndex((e) => e.id === focus.entity);
            const later = new Set(cards.slice(Math.max(card, 0)).map((e) => e.id));
            const before = rows.findIndex((row) => later.has(row.slot.entity));
            return { rows, on, before: before === -1 ? rows.length : before };
        };

        const focusRow = (row: AuditLink | undefined) => {
            if (row) get().focusLink(row.slot.key, row.target);
        };

        /** j and k on step 5: the next or previous link row, across cards. */
        const moveLink = (delta: 1 | -1) => {
            const { rows, on, before } = linkRows();
            const next = on !== -1 ? clamp(on + delta, rows.length - 1) : delta > 0 ? before : before - 1;
            if (next !== on) focusRow(rows[next]);
        };

        /** The way on from an accepted card on step 5: the next link row, round to the start, no one has judged. */
        const focusNextUnjudgedLink = () => {
            const { rows, on, before } = linkRows();
            const { provenance } = documents();
            focusRow(
                nextRound(
                    rows,
                    on !== -1 ? on + 1 : before,
                    (row) => row.key !== get().focus.key && !provenance[row.key]
                )
            );
        };

        /** The way on from a judged analysis: the next analysis in guided order, round to the start, no one has judged. */
        const focusNextUnjudgedAnalysis = () => {
            const { order, at } = guidedIndex(documents(), get());
            const { provenance } = documents();
            const next = nextRound(
                order,
                at + 1,
                (a) => a.key !== get().coordinates?.analysis && !provenance[targetKey(analysisTarget(a.key))]
            );
            if (next) focusCoordinates({ analysis: next.key, point: null, selected: [] });
        };

        session.subscribe((state, previous) => {
            if (state.replaced && state.replaced !== previous.replaced) refocus(state.replaced);
        });

        return {
            focus: initial,
            evidenceCursor: 0,
            reveal: revealed(shownAt(initialCoordinates), null),
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
            accepted: null,
            judged: null,
            gridEngagement: null,

            engageGrid: () => {
                set({ gridEngagement: ++engagements });
                return engagements;
            },
            setOnMade: (clientOpId, values) => void onMade.set(clientOpId, values),
            showAccepted: (accepted) => set({ accepted }),
            showJudged: (judged) => set({ judged }),
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
                const { order, at } = guidedIndex(documents(), get());
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
            selectPoints: (selected) => {
                const { coordinates } = get();
                if (!coordinates || selected.join() === coordinates.selected.join()) return;
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
                if (isLinkStep(get().step)) return moveLink(delta);
                const { focus } = get();
                const slots = shown().entity(focus.entity)?.slots ?? [];
                const at = slots.findIndex((s) => s.key === focus.key);
                const next = stepIn(slots.length, at, delta, delta > 0 ? 0 : slots.length - 1);
                if (slots[next] && next !== at)
                    focusOn({ entity: focus.entity, key: slots[next].key, slot: slots[next].key });
            },
            moveEntity: (delta) => {
                const listed = shown();
                const cards = stepCards({ ...shownDocuments(), step: get().step }) ?? listed.visible;
                const at = cards.findIndex((e) => e.id === get().focus.entity);
                const next = stepIn(cards.length, at, delta);
                if (cards[next] && next !== at) focusOn({ entity: cards[next].id, key: entityKey(cards[next].id) });
            },
            focusNextUnjudged: () => {
                if (isLinkStep(get().step)) return focusNextUnjudgedLink();
                if (get().step === 'coordinates') return focusNextUnjudgedAnalysis();
                const cards = stepCards({ ...shownDocuments(), step: get().step }) ?? [];
                const at = cards.findIndex((e) => e.id === get().focus.entity);
                const { provenance } = documents();
                const next = nextRound(
                    cards,
                    at + 1,
                    (e) => !e.hidden && e.id !== get().focus.entity && !provenance[entityKey(e.id)]
                );
                if (next) focusOn({ entity: next.id, key: entityKey(next.id) });
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
                if (step !== 'coordinates' && coordinates) {
                    left = coordinates;
                    focusCoordinates(null);
                }
                if (step === 'coordinates' && !coordinates) {
                    const kept = left && guided().some((a) => a.key === left?.analysis) ? left : null;
                    const first = kept ?? firstAnalysis(currentAnalyses(documents().bundle), showNonCoordinate);
                    if (first) focusCoordinates(first);
                }
                const cards = stepCards({ ...shownDocuments(), step });
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
