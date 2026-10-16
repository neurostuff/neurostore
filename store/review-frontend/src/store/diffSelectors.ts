import type { ReviewBundle } from '../contract/generated/review-bundle';
import { parseOf } from '../model/coordinates';
import {
    analysisItemFor,
    diffCoordinates,
    diffRecords,
    reviewDiff,
    type FocusIntent,
    type ReviewDiff,
} from '../model/diff';
import { buildRecordIndex, type RecordIndex, type SpanPair } from '../model/record';
import { declaredOf } from './declared';
import type { ReviewState } from './reviewStore';

const originalIndexes = new WeakMap<ReviewBundle['original'], RecordIndex>();

/** The index of the record as loaded, built once per bundle's original. */
export function selectOriginalIndex(s: Pick<ReviewState, 'bundle'>): RecordIndex {
    const { original } = s.bundle;
    let index = originalIndexes.get(original);
    if (!index) {
        index = buildRecordIndex({ ...s.bundle, ...original }, declaredOf);
        originalIndexes.set(original, index);
    }
    return index;
}

/** The review against the original: its record against the record as loaded, its coordinates against the parse. */
export function selectDiff(s: Pick<ReviewState, 'bundle' | 'record' | 'index' | 'provenance'>): ReviewDiff {
    const { parse, revision, originalRecord } = parseOf(s.bundle);
    const records = diffRecords(
        { record: originalRecord, index: selectOriginalIndex(s) },
        { record: s.record, index: s.index }
    );
    return reviewDiff(records, diffCoordinates(parse, revision, s.provenance), s.provenance);
}

const NO_SPANS: SpanPair[] = [];

/** The original's spans of the focused item while the diff is on. */
export function selectOriginalSpans(s: ReviewState): SpanPair[] {
    if (!s.diffOn) return NO_SPANS;
    if (s.coordinates) return analysisItemFor(selectDiff(s), s.coordinates.analysis)?.evidence.before ?? NO_SPANS;
    const original = selectOriginalIndex(s);
    return (original.slot(s.focus.key) ?? original.entity(s.focus.entity))?.spans ?? NO_SPANS;
}

/** Whether focusing `intent` would leave the focus where it is. */
export const isFocused = (s: Pick<ReviewState, 'coordinates' | 'focus'>, intent: FocusIntent): boolean =>
    intent.kind === 'analysis' ? s.coordinates?.analysis === intent.key : !s.coordinates && s.focus.key === intent.key;
