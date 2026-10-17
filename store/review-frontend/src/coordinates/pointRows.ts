import type { CoordinateColumn } from '@neurosynth/coordinate-table';
import { fromSchema } from '../contract/schemas';
import type { Scalar } from '../inspector/schema';
import type { CoordinatePoint } from '../model/coordinates';
import { pointFields, type PointField } from './schema';

type Row = Record<string, unknown>;

/** Where a row keeps the point it was made from, which the grid does not show. */
const SOURCE = '__point';

/** One grid column and the point field it edits: an axis of a vector, a field of a list's first record, or a scalar. */
type GridField =
    | { column: CoordinateColumn; field: string; at: 'axis'; axis: number }
    | { column: CoordinateColumn; field: string; at: 'first'; key: string }
    | { column: CoordinateColumn; field: string; at: 'scalar' };

const singular = (label: string) => label.replace(/s$/, '');

/** Headers shorter than the schema's field names give. */
const HEADERS: Record<string, string> = { 'values.kind': 'statistic' };

const WIDTHS = { number: 58, dropdown: 84, checkbox: 70, text: 120 } as const;
/** Widths a header needs beyond its kind's. */
const WIDTH_OF: Record<string, number> = { cluster_size: 82 };

function columnOf(data: string, header: string, spec: Scalar, required: boolean): CoordinateColumn {
    switch (spec.kind) {
        case 'number':
            return {
                data,
                header,
                kind: 'number',
                required,
                minimum: spec.minimum,
                width: WIDTH_OF[data] ?? WIDTHS.number,
            };
        case 'enum':
            return {
                data,
                header,
                kind: 'dropdown',
                required,
                options: spec.options,
                open: spec.open,
                width: WIDTHS.dropdown,
            };
        case 'boolean':
            return { data, header, kind: 'checkbox', required, width: WIDTHS.checkbox };
        case 'text':
            return { data, header, kind: 'text', required, width: WIDTHS.text };
    }
}

function cellsOf(field: PointField): GridField[] {
    if (field.kind === 'vector') {
        return field.axes.map((axis, i) => ({
            column: columnOf(axis, axis, field.item, true),
            field: field.name,
            at: 'axis',
            axis: i,
        }));
    }
    if (field.kind === 'records') {
        const one = singular(field.label);
        return field.fields.map((f) => ({
            column: columnOf(
                `${field.name}.${f.name}`,
                HEADERS[`${field.name}.${f.name}`] ?? (f.label === one ? one : `${one} ${f.label}`),
                f.spec,
                false
            ),
            field: field.name,
            at: 'first',
            key: f.name,
        }));
    }
    return [{ column: columnOf(field.name, field.label, field.spec, field.required), field: field.name, at: 'scalar' }];
}

const cellsFor = fromSchema('coordinate-parse', (schema) => pointFields(schema).flatMap(cellsOf));

/** Whether a column is one the grid shows before the reviewer asks for all: the coordinates, the first value and the numbers. */
const shownFirst = ({ column, at }: GridField) => at !== 'scalar' || column.kind === 'number';

/**
 * The grid's columns, from the schema's point fields, all of them or those shown first; an empty space cell shows
 * `space`, the analysis's.
 */
export function pointColumns(space?: string | null, all = true): CoordinateColumn[] {
    return cellsFor()
        .filter((cell) => all || shownFirst(cell))
        .map(({ column }) =>
            column.data === 'space' && space ? { ...column, placeholder: `${space} (from analysis)` } : column
        );
}

const isEmpty = (value: unknown) => value === null || value === undefined || value === '';

/** The grid's rows of `points`, each keeping its point. */
export function toRows(points: CoordinatePoint[]): Row[] {
    const cells = cellsFor();
    return points.map((point) => {
        const row: Row = { [SOURCE]: point };
        for (const cell of cells) {
            const value = point[cell.field];
            if (cell.at === 'axis') row[cell.column.data] = (value as unknown[] | undefined)?.[cell.axis];
            else if (cell.at === 'first') row[cell.column.data] = (value as Row[] | null | undefined)?.[0]?.[cell.key];
            else row[cell.column.data] = value;
        }
        return row;
    });
}

const typed = (column: CoordinateColumn, value: unknown) => (column.kind === 'number' ? Number(value) : value);

/** The points the rows make: each row's point with the cells' values, an emptied field left out. */
export function toPoints(rows: Row[]): CoordinatePoint[] {
    const cells = cellsFor();
    return rows.map((row) => {
        const point: Row = { ...((row[SOURCE] as CoordinatePoint | undefined) ?? {}) };
        const firsts = new Map<string, Row>();
        for (const cell of cells) {
            const value = row[cell.column.data];
            if (cell.at === 'axis') {
                const axes = [...((point[cell.field] as unknown[] | undefined) ?? [])];
                axes[cell.axis] = typed(cell.column, value);
                point[cell.field] = axes;
            } else if (cell.at === 'first') {
                const first = firsts.get(cell.field) ?? {
                    ...((point[cell.field] as Row[] | null | undefined)?.[0] ?? {}),
                };
                if (isEmpty(value)) delete first[cell.key];
                else first[cell.key] = typed(cell.column, value);
                firsts.set(cell.field, first);
            } else if (isEmpty(value)) delete point[cell.field];
            else point[cell.field] = typed(cell.column, value);
        }
        for (const [field, first] of firsts) {
            const rest = ((point[field] as Row[] | null | undefined) ?? []).slice(1);
            const records = Object.keys(first).length ? [first, ...rest] : rest;
            if (records.length) point[field] = records;
            else delete point[field];
        }
        return point as CoordinatePoint;
    });
}

/** What keeps a row's first record from being whole: a cell of it filled while another it needs is empty. */
export function pairProblems(rows: Row[]): string[] {
    const firsts = cellsFor().filter((cell): cell is Extract<GridField, { at: 'first' }> => cell.at === 'first');
    return rows.flatMap((row, at) => {
        const filled = firsts.filter((cell) => !isEmpty(row[cell.column.data]));
        if (filled.length === 0) return [];
        return firsts
            .filter((cell) => isEmpty(row[cell.column.data]))
            .map((cell) => `row ${at + 1}: a ${singular(firsts[0].field)} needs its ${cell.column.header}`);
    });
}
