import type { ReviewBundle } from '../contract/generated/review-bundle';
import { clamp, coordinateSpans, type CoordinateFocus } from '../model/coordinateFocus';
import { withHidden, withSlotOrder, type RecordIndex, type SpanPair } from '../model/record';
import type { SessionState } from './sessionStore';
import type { ViewState } from './viewStore';

type Shown = Pick<ViewState, 'focus' | 'slotOrder' | 'showNonCoordinate'>;

const shownFor = new WeakMap<string[], { index: RecordIndex; listHidden: boolean; shown: RecordIndex }>();

/** The index as the view lists it: the hidden entities while it shows them, the focused entity's slots in the order they had when the focus landed. */
export function selectShown({ index }: Pick<SessionState, 'index'>, view: Shown): RecordIndex {
    const { focus, slotOrder, showNonCoordinate: listHidden } = view;
    const last = shownFor.get(slotOrder);
    if (last?.index === index && last.listHidden === listHidden) return last.shown;
    const shown = withSlotOrder(withHidden(index, listHidden), focus.entity, slotOrder);
    shownFor.set(slotOrder, { index, listHidden, shown });
    return shown;
}

export const NO_SPANS: SpanPair[] = [];

const pointSpans = new WeakMap<ReviewBundle, WeakMap<RecordIndex, Map<string, SpanPair[]>>>();

/** The spans of a coordinate focus, worked out once per bundle, index, analysis and point. */
function spansOfPoint(bundle: ReviewBundle, index: RecordIndex, coordinates: CoordinateFocus): SpanPair[] {
    let byIndex = pointSpans.get(bundle);
    if (!byIndex) pointSpans.set(bundle, (byIndex = new WeakMap()));
    let byPoint = byIndex.get(index);
    if (!byPoint) byIndex.set(index, (byPoint = new Map()));
    const key = `${coordinates.analysis}#${coordinates.point}`;
    let spans = byPoint.get(key);
    if (!spans) byPoint.set(key, (spans = coordinateSpans(bundle, coordinates, index)));
    return spans;
}

/** Whether the text holds no span of the analysis `key`, its own or one the record gives. */
export const selectSourceUnknown = ({ bundle, index }: Pick<SessionState, 'bundle' | 'index'>, key: string) =>
    spansOfPoint(bundle, index, { analysis: key, point: null, selected: [] }).length === 0;

/** The spans the focus highlights: the coordinate focus's while there is one, else the record item's. */
export function selectFocusedSpans(
    { bundle, index }: Pick<SessionState, 'bundle' | 'index'>,
    { focus, coordinates }: Pick<ViewState, 'focus' | 'coordinates'>
): SpanPair[] {
    if (coordinates) return spansOfPoint(bundle, index, coordinates);
    return (index.slot(focus.key) ?? index.entity(focus.entity))?.spans ?? NO_SPANS;
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
