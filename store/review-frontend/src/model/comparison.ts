import { cached } from './diff';
import { extractedText, type EntityNode, type RecordIndex, type SlotNode } from './record';
import { slotKey } from './targetKey';

export type Continuous = 'up' | 'down' | 'either' | 'missing';

/** The slot keys of one cell of an analysis's effect. */
export interface CellSlots {
    term: string;
    level: string;
    direction: string;
    label: string;
}

/** One cell of a term's row: its level, if it has one, and its slots. */
export interface LevelEntry {
    cell: number;
    level?: string;
    slots: CellSlots;
}

/** Where a cell's direction puts it in its term's row. */
export type Side = 'positive' | 'negative' | 'held' | 'either' | 'missing';

/** The sides in the order the comparison shows them. */
export const SIDE_ORDER: Side[] = ['positive', 'negative', 'held', 'either', 'missing'];

export type TermRow = {
    term: string;
    termLabel: string;
    continuous?: Continuous;
} & Record<Side, LevelEntry[]>;

export interface Headline {
    text: string;
    /** What the comparison is made within: the held levels. */
    qualifier?: string;
}

export interface Comparison {
    headline: Headline | null;
    rows: TermRow[];
}

const CELL_SLOT = /^effect\.cells\[#(\d+)\]\.(term|level|direction|label)$/;

/** Whether the slot is one of an effect cell's own: its term, level, direction or label. */
export const isCellSlot = (slot: Pick<SlotNode, 'path'>) => CELL_SLOT.test(slot.path);

/** Whether the entity is an analysis whose effect has cells, which its comparison shows in place of their fields. */
export const comparesTerms = (entity: EntityNode) => entity.entityClass === 'Analysis' && entity.slots.some(isCellSlot);

/** The side each direction a cell can hold puts it on. */
export const DIRECTION_SIDES: Record<string, Exclude<Side, 'missing'>> = {
    positive: 'positive',
    negative: 'negative',
    held: 'held',
    undirected: 'either',
};

interface Cell {
    cell: number;
    term: string;
    level?: string;
    side: Side;
}

/** The analysis's effect cells, in their order in the record. */
function cellsOf(analysis: EntityNode): Cell[] {
    const byCell = new Map<number, Partial<Record<keyof CellSlots, SlotNode>>>();
    for (const slot of analysis.slots) {
        const match = CELL_SLOT.exec(slot.path);
        if (!match) continue;
        const at = Number(match[1]);
        byCell.set(at, { ...byCell.get(at), [match[2]]: slot });
    }
    return [...byCell.entries()]
        .sort(([a], [b]) => a - b)
        .map(([cell, slots]) => {
            const direction = extractedText(slots.direction);
            return {
                cell,
                term: slots.term?.references[0] ?? '',
                level: extractedText(slots.level) ?? extractedText(slots.label),
                side: (direction && DIRECTION_SIDES[direction]) || 'missing',
            };
        });
}

const slotsOf = (analysis: string, cell: number): CellSlots => {
    const key = (slot: keyof CellSlots) => slotKey(analysis, `effect.cells[#${cell}].${slot}`);
    return { term: key('term'), level: key('level'), direction: key('direction'), label: key('label') };
};

/** Whether `row` is of a continuous term: one its entity says is, or, where its type is not given, one with no levels. */
function isContinuous(index: RecordIndex, row: TermRow) {
    const type = extractedText(index.entity(row.term)?.slots.find((slot) => slot.path === 'type'));
    if (type) return type === 'continuous';
    return entriesOf(row).every((entry) => entry.level === undefined);
}

/** Which way a continuous term's cells go: missing while any has no direction, else up, down, or either way. */
function wayOf(row: TermRow): Continuous | undefined {
    if (row.missing.length) return 'missing';
    const signed = row.positive.length + row.negative.length + row.either.length;
    if (signed === 0) return undefined;
    if (row.positive.length === signed) return 'up';
    if (row.negative.length === signed) return 'down';
    return 'either';
}

/** A level as the comparison names it: its level, else its term's name. */
export const levelText = (row: TermRow, entry: LevelEntry) => entry.level ?? row.termLabel;
const textsOf = (rows: TermRow[], side: 'positive' | 'negative' | 'held') =>
    rows.flatMap((row) => row[side].map((entry) => levelText(row, entry)));

// Several levels on one side read as "and", claiming no average, sum or conjunction: see the PRD's open question
// "Several levels on one side of a contrast".
const joined = (texts: string[]) => (texts.length ? texts.join(' and ') : '?');

/** One side of an interaction's factor: its levels, or how many where there are more than two. */
const factorSide = (row: TermRow, entries: LevelEntry[]) =>
    entries.length > 2 ? `${entries.length} levels` : joined(entries.map((entry) => levelText(row, entry)));

const isSigned = (row: TermRow) => row.positive.length > 0 || row.negative.length > 0;

function contrast(rows: TermRow[]): Headline {
    const text = `${joined(textsOf(rows, 'positive'))} > ${joined(textsOf(rows, 'negative'))}`;
    const [first, ...rest] = textsOf(rows, 'held');
    if (first === undefined) return { text };
    return { text, qualifier: [`within ${first}`, ...rest.map((held) => `at ${held}`)].join(', ') };
}

function interaction(rows: TermRow[]): Headline {
    const factors = rows
        .filter(isSigned)
        .map((row) =>
            row.continuous ? row.termLabel : `(${factorSide(row, row.positive)} − ${factorSide(row, row.negative)})`
        );
    return { text: factors.join(' × ') };
}

function regression(rows: TermRow[]): Headline {
    const terms = rows.length <= 3 ? rows.map((row) => row.termLabel).join(' + ') : `${rows.length} terms`;
    return { text: `brain measure ~ ${terms}` };
}

/** A simple effect's levels, or, where it has only levels that are less, those after a minus sign. */
function simpleEffect(rows: TermRow[]): Headline {
    const [greater, less] = [textsOf(rows, 'positive'), textsOf(rows, 'negative')];
    return { text: greater.length || !less.length ? joined(greater) : `− ${joined(less)}` };
}

const HEADLINES: Record<string, (rows: TermRow[]) => Headline> = {
    contrast,
    interaction,
    omnibus: (rows) => ({ text: `any difference among ${rows.map((row) => row.termLabel).join(' × ')}` }),
    cross_subject_regression: regression,
    parametric_modulation: regression,
    simple_effect: simpleEffect,
};

function compare(index: RecordIndex, analysis: EntityNode): Comparison {
    const rows = new Map<string, TermRow>();
    for (const { cell, term, level, side } of cellsOf(analysis)) {
        let row = rows.get(term);
        if (!row) {
            row = {
                term,
                termLabel: index.entity(term)?.name ?? term,
                positive: [],
                negative: [],
                held: [],
                either: [],
                missing: [],
            };
            rows.set(term, row);
        }
        row[side].push({ cell, ...(level === undefined ? {} : { level }), slots: slotsOf(analysis.id, cell) });
    }
    for (const row of rows.values()) {
        const way = isContinuous(index, row) ? wayOf(row) : undefined;
        if (way) row.continuous = way;
    }
    const termRows = [...rows.values()];
    const kind = extractedText(analysis.slots.find((slot) => slot.path === 'effect.kind'));
    const headline = kind && kind in HEADLINES ? HEADLINES[kind](termRows) : null;
    return { headline, rows: termRows };
}

const comparisons = new WeakMap<RecordIndex, WeakMap<EntityNode, Comparison>>();

/**
 * What the analysis `analysis` compares: one row per term of its effect's cells, in the order each first appears, and
 * a headline by its effect's kind; worked out once for each index and analysis.
 */
export function comparisonOf(index: RecordIndex, analysis: EntityNode): Comparison {
    return cached(
        cached(comparisons, index, () => new WeakMap()),
        analysis,
        () => compare(index, analysis)
    );
}

/** The row's cells in the order the comparison shows them: greater, less, held, either way, then missing a sign. */
export const entriesOf = (row: TermRow) => SIDE_ORDER.flatMap((side) => row[side]);

const orders = new WeakMap<RecordIndex, WeakMap<EntityNode, SlotNode[]>>();

/**
 * The direction slots of an analysis's cells, in the order its comparison shows them; none for an entity that does
 * not compare terms. Worked out once for each index and entity.
 */
export function comparisonSlots(index: RecordIndex, entity: EntityNode): SlotNode[] {
    if (!comparesTerms(entity)) return [];
    return cached(
        cached(orders, index, () => new WeakMap()),
        entity,
        () =>
            comparisonOf(index, entity).rows.flatMap((row) =>
                entriesOf(row).flatMap((entry) => index.slot(entry.slots.direction) ?? [])
            )
    );
}
