import type { ReviewBundle } from '../contract/generated/review-bundle';
import type { Span } from '../contract/generated/review-ops';
import type { Block, TableBlock } from './layout';
import type { Json } from './paths';
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

/** What a revision's verdict, or the lack of one, makes of an original analysis. */
export type AnalysisChange = 'accept' | 'relabel' | 'edit' | 'split' | 'merge' | 'omit' | 'reject' | 'add';

export interface AnalysisVerdict {
    key: string;
    verdict: AnalysisChange;
    replaced_by?: string[];
}

export interface CoordinateParse {
    analyses?: CoordinateAnalysis[];
    verdicts?: AnalysisVerdict[];
}

/** A bundle's coordinate parse and revision, and the record and revision as loaded, typed. */
export function parseOf(bundle: Pick<ReviewBundle, 'coordinate_parse' | 'coordinate_revision' | 'original'>) {
    return {
        parse: bundle.coordinate_parse as CoordinateParse,
        revision: bundle.coordinate_revision as CoordinateParse | null,
        originalRecord: bundle.original.record as Json,
        loaded: bundle.original.coordinate_revision as CoordinateParse | null,
    };
}

/** The parse's list of analyses, and an analysis's list of points. */
export const ANALYSES = 'analyses';
export const POINTS = 'points';
/** Where a point was read from; kept as read when the point is edited. */
export const READ_FROM = ['row', 'column_group', 'text_span'];
/** The record slot naming the coordinate analysis an entity reports. */
export const RECORD_LINK = 'source_table_analysis';
/** The record's list of analyses. */
export const RECORD_ANALYSES = 'analyses';
/** The record Analysis slots saying whether an analysis found an effect, and over how much of the brain. */
export const RECORD_OUTCOME = 'outcome';
export const RECORD_SCOPE = 'spatial_scope';
/** The outcome of an analysis that found no effect: a null result. */
export const NULL_OUTCOME = 'no_significant_effect';
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

/** The analyses beside each block, by the block's start, each where `place` puts it; those it cannot place are under 'end'. */
export function analysesBeside(
    blocks: Block[],
    analyses: CoordinateAnalysis[],
    place: (analysis: CoordinateAnalysis) => number | undefined = (analysis) => placeOf(blocks, analysis)
) {
    const beside = new Map<number | 'end', CoordinateAnalysis[]>();
    for (const analysis of analyses) {
        const at = place(analysis) ?? 'end';
        beside.set(at, [...(beside.get(at) ?? []), analysis]);
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

const PRINTED_NUMBER = /(?:[-\u2212\u2012\u2013\u2014\uFE63\uFF0D]\s?)?\d+(?:\.\d+)?/g;
/** The most text between two of a point's printed coordinates, as in "X = 26, Y = − 8". */
const COORDINATE_GAP = 12;

/** The numbers `text` prints, with where. */
function printedNumbers(text: string) {
    return [...text.matchAll(PRINTED_NUMBER)].map((m) => ({
        value: Number(m[0].replace(MINUS, '-').replace(/\s/g, '')),
        start: m.index,
        end: m.index + m[0].length,
    }));
}

type Printed = ReturnType<typeof printedNumbers>;

/** Whether the numbers `run` sits close together, as one point's coordinates are printed. */
const together = (run: Printed) => run.every((n, i) => i === 0 || n.start - run[i - 1].end <= COORDINATE_GAP);

/**
 * The numbers each paper's text prints, by its bundle: a focus looks up every point of an analysis in the whole
 * text, so the text is read once per bundle rather than once per point.
 */
const printedIn = new WeakMap<Pick<ReviewBundle, 'text'>, Printed>();

/** The span of the paper's text printing `coordinates` in order, close together; the first such, if any. */
export function textPointSpan(paper: Pick<ReviewBundle, 'text'>, coordinates: number[]): [number, number] | undefined {
    let numbers = printedIn.get(paper);
    if (!numbers) printedIn.set(paper, (numbers = printedNumbers(paper.text)));
    for (let at = 0; at + coordinates.length <= numbers.length; at++) {
        const run = numbers.slice(at, at + coordinates.length);
        if (run.every((n, i) => n.value === coordinates[i]) && together(run)) {
            return [run[0].start, run[run.length - 1].end];
        }
    }
    return undefined;
}

/** The first three numbers `text` prints close together, read as a point's x, y and z. */
export function printedCoordinates(text: string): [number, number, number] | undefined {
    const numbers = printedNumbers(text);
    for (let at = 0; at + 3 <= numbers.length; at++) {
        const run = numbers.slice(at, at + 3);
        if (together(run)) return run.map((n) => n.value) as [number, number, number];
    }
    return undefined;
}

/** The originals an analysis comes from: those it is derived from, or itself when it is carried over. */
export const originsOf = (analysis: CoordinateAnalysis) =>
    analysis.derived_from?.length ? analysis.derived_from : [analysis.key];

/** No op's word on which analyses replaced which. */
const NO_REPLACEMENTS: ReadonlyMap<string, string[]> = new Map();

/**
 * The analyses of `after` that took the place of `key` in `before`, the one to follow first: itself, else those the
 * ops' `replaced` (each key an op took away, to the keys it put in its place) lead to, else the new analyses sharing
 * its originals; none when nothing did.
 */
export function inPlaceOf(
    before: CoordinateAnalysis[],
    after: CoordinateAnalysis[],
    key: string,
    replaced: ReadonlyMap<string, string[]> = NO_REPLACEMENTS
): CoordinateAnalysis[] {
    const present = new Map(after.map((analysis) => [analysis.key, analysis]));
    const found = new Set<CoordinateAnalysis>();
    const seen = new Set<string>();
    const follow = (at: string) => {
        const analysis = present.get(at);
        if (analysis) return void found.add(analysis);
        if (seen.has(at)) return;
        seen.add(at);
        for (const next of replaced.get(at) ?? []) follow(next);
    };
    follow(key);
    if (found.size) return [...found];
    const gone = before.find((analysis) => analysis.key === key);
    if (!gone) return [];
    const origins = new Set(originsOf(gone));
    const known = new Set(before.map((analysis) => analysis.key));
    return after.filter((analysis) => !known.has(analysis.key) && originsOf(analysis).some((k) => origins.has(k)));
}

/** The key of the analysis in `after` that takes the place of `key` in `before`: the first `inPlaceOf` gives. */
export const successor = (
    before: CoordinateAnalysis[],
    after: CoordinateAnalysis[],
    key: string,
    replaced?: ReadonlyMap<string, string[]>
): string | undefined => inPlaceOf(before, after, key, replaced)[0]?.key;

const NONE: EntityNode[] = [];
/**
 * The record entities naming each coordinate analysis, by the index's entity list: every card asks for its
 * analysis's on each render, and the list is replaced whenever an entity changes.
 */
const naming = new WeakMap<RecordIndex['entities'], Map<unknown, EntityNode[]>>();

/** The record's entities that name the coordinate analysis `key`; the same list for the same index. */
export function entitiesNaming(index: Pick<RecordIndex, 'entities'>, key: string): EntityNode[] {
    let byKey = naming.get(index.entities);
    if (!byKey) {
        byKey = new Map();
        for (const entity of index.entities) {
            const named = entity.slots.find((slot) => slot.path === RECORD_LINK)?.value?.value;
            if (named !== undefined) byKey.set(named, [...(byKey.get(named) ?? []), entity]);
        }
        naming.set(index.entities, byKey);
    }
    return byKey.get(key) ?? NONE;
}

/** The coordinate analysis among `analyses` that the record entity `entity` names. */
export function analysisNamedBy(entity: EntityNode | undefined, analyses: CoordinateAnalysis[]) {
    const key = entity?.slots.find((slot) => slot.path === RECORD_LINK)?.value?.value;
    return typeof key === 'string' ? analyses.find((analysis) => analysis.key === key) : undefined;
}
