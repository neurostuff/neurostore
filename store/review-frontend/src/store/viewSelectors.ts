import type { ReviewBundle } from '../contract/generated/review-bundle';
import { clamp, coordinateSpans, type CoordinateFocus } from '../model/coordinateFocus';
import { cached } from '../model/diff';
import { sortSpans, withHidden, type RecordIndex, type SlotNode, type SpanPair } from '../model/record';
import { relationshipKey } from '../model/targetKey';
import type { SessionState } from './sessionStore';
import type { ViewState } from './viewStore';

/** The index as the view lists it: the hidden entities too while it shows them. */
export const selectShown = ({ index }: Pick<SessionState, 'index'>, view: Pick<ViewState, 'showNonCoordinate'>) =>
    withHidden(index, view.showNonCoordinate);

export const NO_SPANS: SpanPair[] = [];

const pointSpans = new WeakMap<ReviewBundle, WeakMap<RecordIndex, Map<string, SpanPair[]>>>();

/** The spans of a coordinate focus, worked out once per bundle, index, analysis and point. */
function spansOfPoint(bundle: ReviewBundle, index: RecordIndex, coordinates: CoordinateFocus): SpanPair[] {
    const byPoint = cached(
        cached(pointSpans, bundle, () => new WeakMap()),
        index,
        () => new Map()
    );
    const key = `${coordinates.analysis}#${coordinates.point}`;
    let spans = byPoint.get(key);
    if (!spans) byPoint.set(key, (spans = coordinateSpans(bundle, coordinates, index)));
    return spans;
}

const referenceSpans = new WeakMap<RecordIndex, Map<string, SpanPair[]>>();

/** The spans of the entity `id`, none while it is hidden or absent. */
const shownSpans = (index: RecordIndex, id: string): SpanPair[] => {
    const entity = index.entity(id);
    return entity && !entity.hidden ? entity.spans : NO_SPANS;
};

/**
 * The spans of a reference slot: every span of each referenced entity that is not hidden, worked out once per index
 * and slot. A reference slot holds no value, so it has no spans of its own.
 */
function spansOfReference(index: RecordIndex, slot: SlotNode): SpanPair[] {
    const bySlot = cached(referenceSpans, index, () => new Map());
    let spans = bySlot.get(slot.key);
    if (!spans) bySlot.set(slot.key, (spans = sortSpans(slot.references.flatMap((id) => shownSpans(index, id)))));
    return spans;
}

const linkSpans = new WeakMap<RecordIndex, Map<string, SpanPair[]>>();

/** The spans of the link `key` of a reference slot: its entity's and the linked entity's, worked out once per index and link. */
function spansOfLink(index: RecordIndex, slot: SlotNode, key: string): SpanPair[] {
    const byLink = cached(linkSpans, index, () => new Map());
    let spans = byLink.get(key);
    if (!spans) {
        const target = slot.references.find((id) => relationshipKey(slot.entity, slot.path, id) === key);
        const own = index.entity(slot.entity)?.spans ?? NO_SPANS;
        byLink.set(key, (spans = sortSpans([...own, ...(target === undefined ? [] : shownSpans(index, target))])));
    }
    return spans;
}

/** Whether the text holds no span of the analysis `key`, its own or one the record gives. */
export const selectSourceUnknown = ({ bundle, index }: Pick<SessionState, 'bundle' | 'index'>, key: string) =>
    spansOfPoint(bundle, index, { analysis: key, point: null, selected: [] }).length === 0;

/**
 * The spans the focus highlights: the coordinate focus's while there is one, else the record item's: for a reference
 * slot, its referenced entities' spans; for a link, its entity's and the linked entity's.
 */
export function selectFocusedSpans(
    { bundle, index }: Pick<SessionState, 'bundle' | 'index'>,
    { focus, coordinates }: Pick<ViewState, 'focus' | 'coordinates'>
): SpanPair[] {
    if (coordinates) return spansOfPoint(bundle, index, coordinates);
    const slot = index.slot(focus.key);
    if (slot?.kind === 'reference') return spansOfReference(index, slot);
    const holding = !slot && focus.slot !== undefined ? index.slot(focus.slot) : undefined;
    if (holding?.kind === 'reference') return spansOfLink(index, holding, focus.key);
    return (slot ?? index.entity(focus.entity))?.spans ?? NO_SPANS;
}

export const selectEvidenceCursor = (
    session: Pick<SessionState, 'bundle' | 'index'>,
    view: Pick<ViewState, 'focus' | 'coordinates' | 'evidenceCursor'>
): number => clamp(view.evidenceCursor, Math.max(selectFocusedSpans(session, view).length - 1, 0));

/** The span the evidence cursor is on while a value slot is focused: the one its handles, keys and remove control act on. */
export function selectCursorSpan(
    session: Pick<SessionState, 'bundle' | 'index'>,
    view: Pick<ViewState, 'focus' | 'coordinates' | 'evidenceCursor'>
): SpanPair | null {
    const { focus, coordinates } = view;
    if (coordinates || focus.slot !== focus.key || session.index.slot(focus.key)?.kind !== 'value') return null;
    return selectFocusedSpans(session, view)[selectEvidenceCursor(session, view)] ?? null;
}
