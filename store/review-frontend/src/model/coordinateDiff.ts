import type { ProvenanceMap } from './applyOp';
import {
    hasPoints,
    originsOf,
    type AnalysisChange,
    type CoordinateAnalysis,
    type CoordinateParse,
} from './coordinates';
import { cached, sameJson, type DiffStatus, type Item } from './diff';
import { sortSpans, type SpanPair } from './record';
import { targetKey } from './targetKey';

export interface AnalysisDiff extends Item {
    kind: 'analysis';
    change: AnalysisChange;
    before?: CoordinateAnalysis;
    after: CoordinateAnalysis[];
}

const analysisSpans = (analysis: CoordinateAnalysis | undefined): SpanPair[] =>
    sortSpans(
        [
            ...(analysis?.text_spans ?? []),
            ...(analysis?.points ?? []).flatMap((p) => (p.text_span ? [p.text_span] : [])),
        ].map((s): SpanPair => [s.start_char, s.end_char])
    );

const withoutOrigins = (analysis: CoordinateAnalysis) =>
    Object.fromEntries(Object.entries(analysis).filter(([name]) => name !== 'derived_from'));

const analysisKey = (key: string) => targetKey({ kind: 'coordinate_analysis', analysis_key: key });

function item(
    key: string,
    status: DiffStatus,
    change: AnalysisChange,
    before: CoordinateAnalysis | undefined,
    after: CoordinateAnalysis[]
): AnalysisDiff {
    return {
        kind: 'analysis',
        key: analysisKey(key),
        status,
        change,
        hidden: !hasPoints(before ?? after[0]),
        before,
        after,
        evidence: { before: analysisSpans(before), after: sortSpans(after.flatMap(analysisSpans)) },
    };
}

/**
 * What became of each analysis of `base` in `current`, from the analyses alone. One `current` keeps under its key
 * replaces it, with any new analysis derived from that key; else the new analyses sharing its originals do.
 */
function replacementsOf(base: CoordinateAnalysis[], current: CoordinateAnalysis[]): CoordinateAnalysis[][] {
    const known = new Set(base.map((a) => a.key));
    const fresh = current.filter((a) => !known.has(a.key));
    return base.map((before) => {
        if (current.some((a) => a.key === before.key)) {
            return current.filter(
                (a) => a.key === before.key || (fresh.includes(a) && originsOf(a).includes(before.key))
            );
        }
        const origins = new Set(originsOf(before));
        return fresh.filter((a) => originsOf(a).some((k) => origins.has(k)));
    });
}

function buildCoordinateDiff(
    base: CoordinateParse,
    current: CoordinateParse,
    provenance: ProvenanceMap
): AnalysisDiff[] {
    const originals = base.analyses ?? [];
    const analyses = current.analyses ?? [];
    const rejected = (key: string) => provenance[analysisKey(key)]?.state === 'removed';
    const replacing = replacementsOf(originals, analyses);
    const shared = new Map<string, number>();
    for (const after of replacing.flat()) shared.set(after.key, (shared.get(after.key) ?? 0) + 1);
    const judged = originals.map((original, i) => {
        const after = replacing[i];
        if (after.length === 0) return item(original.key, 'removed', 'omit', original, []);
        if (after.every((a) => rejected(a.key))) return item(original.key, 'removed', 'reject', original, []);
        if (after.length > 1) return item(original.key, 'changed', 'split', original, after);
        const [only] = after;
        if (only.key !== original.key) {
            return item(original.key, 'changed', shared.get(only.key)! > 1 ? 'merge' : 'edit', original, after);
        }
        if (only.role !== original.role) return item(original.key, 'changed', 'relabel', original, after);
        const same = sameJson(withoutOrigins(original), withoutOrigins(only));
        return item(original.key, same ? 'same' : 'changed', same ? 'accept' : 'edit', original, after);
    });
    const known = new Set(originals.map((a) => a.key));
    const added = analyses
        .filter((a) => !known.has(a.key) && !a.derived_from?.length)
        .map((a) => item(a.key, rejected(a.key) ? 'removed' : 'added', 'add', undefined, [a]));
    return [...judged, ...added];
}

const coordinateDiffs = new WeakMap<
    CoordinateParse,
    WeakMap<CoordinateParse, WeakMap<ProvenanceMap, AnalysisDiff[]>>
>();

/**
 * Each coordinate analysis of `base`, the coordinates as loaded, as `revision` has made it, then those the reviewer
 * added; computed once per base, revision and provenance.
 */
export function diffCoordinates(
    base: CoordinateParse | null | undefined,
    revision: CoordinateParse | null | undefined,
    provenance: ProvenanceMap
): AnalysisDiff[] {
    if (!base) return [];
    const current = revision ?? base;
    const ofBase = cached(coordinateDiffs, base, () => new WeakMap());
    const ofRevision = cached(ofBase, current, () => new WeakMap());
    return cached(ofRevision, provenance, () => buildCoordinateDiff(base, current, provenance));
}
