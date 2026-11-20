import type { ProvenanceMap } from './applyOp';
import type { CoordinateAnalysis, CoordinateParse } from './coordinates';
import { sameJson } from './diff';
import { analysisTarget, targetKey } from './targetKey';

/** Who made an analysis what it is now, when someone changed it from the parse. */
export type Authorship = 'reviewer' | 'model';

/**
 * The reviewer once the review's provenance has the analysis; else the model when the pipeline's revision the source
 * was loaded with holds it other than the parse read it; else null, for an analysis as the parse read it.
 */
export function authorship(
    analysis: CoordinateAnalysis,
    parse: CoordinateParse | null | undefined,
    loaded: CoordinateParse | null | undefined,
    provenance: ProvenanceMap
): Authorship | null {
    if (provenance[targetKey(analysisTarget(analysis.key))]) return 'reviewer';
    const asLoaded = loaded?.analyses?.find((candidate) => candidate.key === analysis.key);
    if (!asLoaded) return null;
    const raw = parse?.analyses?.find((candidate) => candidate.key === analysis.key);
    return raw && sameJson(raw, asLoaded) ? null : 'model';
}
