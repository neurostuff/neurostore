import type { ReviewBundle } from '../contract/generated/review-bundle';
import { parseOf } from '../model/coordinates';
import { diffCoordinates } from '../model/coordinateDiff';
import { analysisItemFor, diffRecords, reviewDiff, type FocusIntent, type ReviewDiff } from '../model/diff';
import { buildRecordIndex, type RecordIndex, type SpanPair } from '../model/record';
import { declaredOf } from './declared';
import type { SessionState } from './sessionStore';
import type { ViewState } from './viewStore';

const originalIndexes = new WeakMap<ReviewBundle['original'], RecordIndex>();

/** The index of the record as loaded, built once per bundle's original. */
export function selectOriginalIndex(s: Pick<SessionState, 'bundle'>): RecordIndex {
    const { original } = s.bundle;
    let index = originalIndexes.get(original);
    if (!index) {
        index = buildRecordIndex({ ...s.bundle, ...original }, declaredOf);
        originalIndexes.set(original, index);
    }
    return index;
}

/** The review against the original: its record against the record as loaded, its coordinates against the coordinates as loaded. */
export function selectDiff(s: Pick<SessionState, 'bundle' | 'record' | 'index' | 'provenance'>): ReviewDiff {
    const { parse, revision, originalRecord, loaded } = parseOf(s.bundle);
    const records = diffRecords(
        { record: originalRecord, index: selectOriginalIndex(s) },
        { record: s.record, index: s.index }
    );
    return reviewDiff(records, diffCoordinates(loaded ?? parse, revision, s.provenance), s.provenance);
}

const NO_SPANS: SpanPair[] = [];

/** The original's spans of the focused item while the diff is on. */
export function selectOriginalSpans(
    session: Pick<SessionState, 'bundle' | 'record' | 'index' | 'provenance'>,
    { diffOn, coordinates, focus }: Pick<ViewState, 'diffOn' | 'coordinates' | 'focus'>
): SpanPair[] {
    if (!diffOn) return NO_SPANS;
    if (coordinates) return analysisItemFor(selectDiff(session), coordinates.analysis)?.evidence.before ?? NO_SPANS;
    const original = selectOriginalIndex(session);
    return (original.slot(focus.key) ?? original.entity(focus.entity))?.spans ?? NO_SPANS;
}

/** Whether focusing `intent` would leave the focus where it is. */
export const isFocused = (s: Pick<ViewState, 'coordinates' | 'focus'>, intent: FocusIntent): boolean =>
    intent.kind === 'analysis' ? s.coordinates?.analysis === intent.key : !s.coordinates && s.focus.key === intent.key;
