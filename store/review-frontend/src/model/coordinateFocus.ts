import type { ReviewBundle } from '../contract/generated/review-bundle';
import {
    currentAnalyses,
    entitiesNaming,
    guidedOrder,
    originsOf,
    pointSpan,
    successor,
    textPointSpan,
    type CoordinateAnalysis,
    type CoordinatePoint,
} from './coordinates';
import type { RecordIndex, SpanPair } from './record';
import { layoutText, type Block, type ParsedPaperLayout, type TableBlock } from './layout';

/** The focused coordinate analysis, by its key in the revision, its focused point and the points selected in it. */
export interface CoordinateFocus {
    analysis: string;
    point: number | null;
    selected: number[];
}

export const clamp = (value: number, max: number) => Math.min(Math.max(value, 0), max);

const inOrder = (spans: SpanPair[]) =>
    [...new Map(spans.map((s) => [`${s[0]}:${s[1]}`, s])).values()].sort((a, b) => a[0] - b[0] || a[1] - b[1]);

export const focusedAnalysis = (s: { bundle: ReviewBundle; coordinates: CoordinateFocus | null }) =>
    currentAnalyses(s.bundle).find((analysis) => analysis.key === s.coordinates?.analysis);

type Index = Pick<RecordIndex, 'entities' | 'entity'>;

/** What a span step reads: the analysis, its table's block if it has one, and the points in focus. */
interface SpanSource {
    bundle: ReviewBundle;
    index: Index;
    analysis: CoordinateAnalysis;
    table: TableBlock | undefined;
    points: CoordinatePoint[];
    /** Whether the whole analysis is in focus, not one of its points. */
    whole: boolean;
}

/** The spans the analysis carries: each point's own span or table row and, in focus as a whole, the analysis's. */
function ownSpans({ bundle, analysis, table, points, whole }: SpanSource): SpanPair[] {
    const read = points.flatMap((point) => {
        const at = pointSpan(bundle.text, point, table);
        return at ? [at] : [];
    });
    const own = whole ? (analysis.text_spans ?? []).map((s): SpanPair => [s.start_char, s.end_char]) : [];
    return [...read, ...own];
}

/**
 * Where the record reports the analysis: the evidence of its coordinate_sets entry, whose local_id is its key or
 * an original's, else the spans of the record entities naming it.
 */
function recordSpans({ index, analysis }: SpanSource): SpanPair[] {
    const sets = [analysis.key, ...originsOf(analysis)].flatMap((key) => index.entity(key)?.spans ?? []);
    if (sets.length) return sets;
    return entitiesNaming(index, analysis.key).flatMap((entity) => entity.spans);
}

/** Where the text prints each point's x, y and z; a table analysis is read from its table only. */
function printedSpans({ bundle, table, points }: SpanSource): SpanPair[] {
    if (table) return [];
    return points.flatMap((point) => {
        const at = textPointSpan(bundle, point.coordinates);
        return at ? [at] : [];
    });
}

const SPAN_STEPS = [ownSpans, recordSpans, printedSpans];

const NO_INDEX: Index = { entities: [], entity: () => undefined };

/**
 * The spans a coordinate focus highlights, for the focused point or every point: the first that the analysis
 * carries, the record reports, or the text prints.
 */
export function coordinateSpans(bundle: ReviewBundle, focus: CoordinateFocus, index: Index = NO_INDEX): SpanPair[] {
    const analysis = currentAnalyses(bundle).find((a) => a.key === focus.analysis);
    if (!analysis) return [];
    const blocks = layoutText(bundle.text, bundle.parsed_paper as ParsedPaperLayout);
    const table = blocks.find((b): b is TableBlock => b.kind === 'table' && b.tableId === analysis.table_id);
    const points = analysis.points ?? [];
    const shown = focus.point === null ? points : points.slice(focus.point, focus.point + 1);
    const source = { bundle, index, analysis, table, points: shown, whole: focus.point === null };
    for (const step of SPAN_STEPS) {
        const spans = step(source);
        if (spans.length) return inOrder(spans);
    }
    return [];
}

/** The start of the block an analysis sits beside: its table's, else that of the block holding its first span. */
export function analysisPlace(
    bundle: ReviewBundle,
    index: Index,
    blocks: Block[],
    analysis: CoordinateAnalysis
): number | undefined {
    if (analysis.table_id) {
        return blocks.find((block) => block.kind === 'table' && block.tableId === analysis.table_id)?.start;
    }
    const [first] = coordinateSpans(bundle, { analysis: analysis.key, point: null, selected: [] }, index);
    if (!first) return undefined;
    return blocks.find((block) => block.start <= first[0] && first[0] < block.end)?.start;
}

/** Where the text shows an analysis with no span: at its table, else at the end of the text, where its card sits. */
export function placeReveal(bundle: ReviewBundle, key: string): SpanPair {
    const analysis = currentAnalyses(bundle).find((a) => a.key === key);
    const blocks = layoutText(bundle.text, bundle.parsed_paper as ParsedPaperLayout);
    const table = blocks.find((b) => b.kind === 'table' && b.tableId === analysis?.table_id);
    if (table) return [table.start, Math.min(table.start + 1, table.end)];
    return [Math.max(bundle.text.length - 1, 0), bundle.text.length];
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
