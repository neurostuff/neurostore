import type { ReviewBundle } from '../contract/generated/review-bundle';
import { analysisPlace } from '../model/coordinateFocus';
import type { CoordinateAnalysis } from '../model/coordinates';
import { layoutText, type ParsedPaperLayout } from '../model/layout';
import type { RecordIndex } from '../model/record';

const pointCount = (n: number) => `${n} ${n === 1 ? 'point' : 'points'}`;

/** Where an analysis is read from: its table by label, or the text under the heading of the section holding it. */
function sourceOf(bundle: ReviewBundle, index: RecordIndex, analysis: CoordinateAnalysis) {
    const paper = bundle.parsed_paper as ParsedPaperLayout;
    if (analysis.table_id) {
        return `from ${paper.tables?.find((t) => t.table_id === analysis.table_id)?.label ?? analysis.table_id}`;
    }
    const blocks = layoutText(bundle.text, paper);
    const place = analysisPlace(bundle, index, blocks, analysis);
    const heading = blocks.filter((b) => b.kind === 'heading' && place !== undefined && b.start <= place).at(-1);
    if (heading?.kind !== 'heading') return 'from the text';
    return `from the text (${bundle.text.slice(heading.markerEnd, heading.contentEnd).trim()})`;
}

/** What a reviewer reads of an analysis first: its space, where it is read from, and how many points it has. */
export function analysisSummary(bundle: ReviewBundle, index: RecordIndex, analysis: CoordinateAnalysis): string {
    return [analysis.coordinate_space, sourceOf(bundle, index, analysis), pointCount(analysis.points?.length ?? 0)]
        .filter(Boolean)
        .join(' · ');
}
