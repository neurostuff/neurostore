import type { ReviewBundle } from '../contract/generated/review-bundle';
import type { Span } from '../contract/generated/review-ops';
import type { Block, TableBlock } from '../text/layout';
import type { EntityNode, RecordIndex } from './record';

export interface CoordinatePoint {
    coordinates: [number, number, number];
    text_span?: Span | null;
    row?: number | null;
    [field: string]: unknown;
}

export interface CoordinateAnalysis {
    key: string;
    name: string;
    role: string;
    origin: string;
    table_id?: string | null;
    text_spans?: Span[] | null;
    coordinate_space?: string | null;
    points?: CoordinatePoint[] | null;
    derived_from?: string[] | null;
    [field: string]: unknown;
}

export interface CoordinateParse {
    analyses?: CoordinateAnalysis[];
}

/** The parse's list of analyses, and an analysis's list of points. */
export const ANALYSES = 'analyses';
export const POINTS = 'points';
/** Where a point was read from; kept as read when the point is edited. */
export const READ_FROM = ['row', 'column_group', 'text_span'];
/** The record slot naming the coordinate analysis an entity reports. */
export const RECORD_LINK = 'source_table_analysis';
/** What a reviewer gives an analysis they add or relabel. */
export const ANALYSIS_EDITS = ['name', 'role', 'coordinate_space'];

/** Throws unless the coordinate revision or the original parse has an analysis with `key`. */
export function knownAnalysis(
    parse: CoordinateParse | null | undefined,
    revision: CoordinateParse | null | undefined,
    key: string
) {
    const holds = (document: CoordinateParse | null | undefined) =>
        (document?.analyses ?? []).some((candidate) => candidate.key === key);
    if (!holds(revision) && !holds(parse)) throw new Error(`the coordinate parse has no analysis '${key}'`);
}

/** The analyses as the review has them: the revision's, or the original parse's before any change. */
export function currentAnalyses(bundle: Pick<ReviewBundle, 'coordinate_parse' | 'coordinate_revision'>) {
    const parse: CoordinateParse | null | undefined = bundle.coordinate_revision ?? bundle.coordinate_parse;
    return parse?.analyses ?? [];
}

/** The analyses of `next`, each one `previous` holds under its key with the same content in place of its copy. */
export function keepUnchanged(previous: CoordinateAnalysis[], next: CoordinateAnalysis[]): CoordinateAnalysis[] {
    const held = new Map(previous.map((analysis) => [analysis.key, analysis]));
    return next.map((analysis) => {
        const before = held.get(analysis.key);
        return before && JSON.stringify(before) === JSON.stringify(analysis) ? before : analysis;
    });
}

export const hasPoints = (analysis: CoordinateAnalysis) => (analysis.points ?? []).length > 0;

/** The analyses in guided order: those with points in parse order, then, when shown, those without. */
export function guidedOrder(analyses: CoordinateAnalysis[], showNonCoordinate: boolean) {
    const withPoints = analyses.filter(hasPoints);
    return showNonCoordinate ? [...withPoints, ...analyses.filter((a) => !hasPoints(a))] : withPoints;
}

/** Where an analysis sits: the start of its table's block, or of the block holding its first span. */
function placeOf(blocks: Block[], analysis: CoordinateAnalysis): number | undefined {
    if (analysis.table_id) {
        return blocks.find((block) => block.kind === 'table' && block.tableId === analysis.table_id)?.start;
    }
    const first = analysis.text_spans?.[0] ?? analysis.points?.find((p) => p.text_span)?.text_span;
    if (!first) return undefined;
    return blocks.find((block) => block.start <= first.start_char && first.start_char < block.end)?.start;
}

/** The analyses beside each block, by the block's start; those the text cannot place are under 'end'. */
export function analysesBeside(blocks: Block[], analyses: CoordinateAnalysis[]) {
    const beside = new Map<number | 'end', CoordinateAnalysis[]>();
    for (const analysis of analyses) {
        const place = placeOf(blocks, analysis) ?? 'end';
        beside.set(place, [...(beside.get(place) ?? []), analysis]);
    }
    return beside;
}

const MINUS = /[\u2212\u2012\u2013\u2014\uFE63\uFF0D]/g;
const numberIn = (cell: string) => {
    const text = cell.trim().replace(MINUS, '-');
    return text === '' ? NaN : Number(text);
};

/** The span of the text a point is read from: its own text span, else the row of `table` printing its coordinates in order. */
export function pointSpan(
    text: string,
    point: CoordinatePoint,
    table: TableBlock | undefined
): [number, number] | undefined {
    if (point.text_span) return [point.text_span.start_char, point.text_span.end_char];
    const wanted = point.coordinates;
    const row = table?.rows.find((candidate) => {
        const numbers = candidate.cells.map((cell) => numberIn(text.slice(cell.start, cell.contentEnd)));
        return numbers.some((_, at) => wanted.every((value, i) => numbers[at + i] === value));
    });
    return row && [row.start, row.cells[row.cells.length - 1].contentEnd];
}

/** The originals an analysis comes from: those it is derived from, or itself when it is carried over. */
const originsOf = (analysis: CoordinateAnalysis) =>
    analysis.derived_from?.length ? analysis.derived_from : [analysis.key];

/** The key of the analysis in `after` that takes the place of `key` in `before`: itself, else the first new analysis sharing its originals. */
export function successor(before: CoordinateAnalysis[], after: CoordinateAnalysis[], key: string): string | undefined {
    if (after.some((analysis) => analysis.key === key)) return key;
    const replaced = before.find((analysis) => analysis.key === key);
    if (!replaced) return undefined;
    const origins = new Set(originsOf(replaced));
    const known = new Set(before.map((analysis) => analysis.key));
    return after.find((analysis) => !known.has(analysis.key) && originsOf(analysis).some((k) => origins.has(k)))?.key;
}

/** The record's entities that name the coordinate analysis `key`. */
export function entitiesNaming(index: Pick<RecordIndex, 'entities'>, key: string): EntityNode[] {
    return index.entities.filter((entity) =>
        entity.slots.some((slot) => slot.path === RECORD_LINK && slot.value?.value === key)
    );
}
