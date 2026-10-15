import type { ReviewBundle } from '../contract/generated/review-bundle';
import { currentAnalyses, guidedOrder, pointSpan, successor, type CoordinateAnalysis } from '../model/coordinates';
import type { SpanPair } from '../model/record';
import { layoutText, type ParsedPaperLayout, type TableBlock } from '../text/layout';
import type { CoordinateFocus } from '../store/reviewStore';

export const clamp = (value: number, max: number) => Math.min(Math.max(value, 0), max);

const inOrder = (spans: SpanPair[]) =>
    [...new Map(spans.map((s) => [`${s[0]}:${s[1]}`, s])).values()].sort((a, b) => a[0] - b[0] || a[1] - b[1]);

/** The spans a coordinate focus highlights: the focused point's, or every point's and the analysis's own. */
export function coordinateSpans(bundle: ReviewBundle, focus: CoordinateFocus): SpanPair[] {
    const analysis = currentAnalyses(bundle).find((a) => a.key === focus.analysis);
    if (!analysis) return [];
    const blocks = layoutText(bundle.text, bundle.parsed_paper as ParsedPaperLayout);
    const table = blocks.find((b): b is TableBlock => b.kind === 'table' && b.tableId === analysis.table_id);
    const points = analysis.points ?? [];
    const shown = focus.point === null ? points : points.slice(focus.point, focus.point + 1);
    const spans = shown.flatMap((point) => {
        const at = pointSpan(bundle.text, point, table);
        return at ? [at] : [];
    });
    if (focus.point === null) {
        spans.push(...(analysis.text_spans ?? []).map((s): SpanPair => [s.start_char, s.end_char]));
    }
    return inOrder(spans);
}

/** The focus on the first analysis in guided order, or none when there are no analyses. */
export function firstAnalysis(analyses: CoordinateAnalysis[], shown: boolean): CoordinateFocus | null {
    const first = guidedOrder(analyses, shown)[0];
    return first ? { analysis: first.key, point: null, selected: [] } : null;
}

/**
 * The focus once the analyses change from `before` to `after`: on `added`, else on the analysis that replaced
 * the focused one, else on the one now in its place. The focused analysis kept keeps its point, within its count.
 */
export function nextFocus(
    before: CoordinateAnalysis[],
    after: CoordinateAnalysis[],
    focus: CoordinateFocus,
    shown: boolean,
    added?: CoordinateAnalysis
): CoordinateFocus | null {
    const placed = guidedOrder(before, shown).findIndex((a) => a.key === focus.analysis);
    const order = guidedOrder(after, shown);
    const key = added?.key ?? successor(before, after, focus.analysis) ?? order[clamp(placed, order.length - 1)]?.key;
    const analysis = after.find((a) => a.key === key);
    if (!analysis) return null;
    const count = analysis.points?.length ?? 0;
    if (key === focus.analysis) {
        const selected = focus.selected.filter((i) => i < count);
        return {
            ...focus,
            point: focus.point !== null && focus.point < count ? focus.point : null,
            selected: selected.length === focus.selected.length ? focus.selected : selected,
        };
    }
    const point = focus.point === null || count === 0 ? null : Math.min(focus.point, count - 1);
    return { analysis: analysis.key, point, selected: [] };
}
