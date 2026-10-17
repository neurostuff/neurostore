import { useState } from 'react';
import { fromSchema } from '../contract/schemas';
import { parseScalar, textOf, type Parsed, type Scalar } from '../inspector/schema';
import { pointFields, type PointField } from './schema';

type Point = Record<string, unknown>;

interface RecordRow {
    id: number;
    texts: Record<string, string>;
    rest: Point;
}

const pointFieldsOf = fromSchema('coordinate-parse', pointFields);
const REQUIRED = 'required';

export const axisKey = (name: string, i: number) => `${name}.${i}`;
export const recordKey = (name: string, row: number, field: string) => `${name}.${row}.${field}`;

const parsed = (spec: Scalar, raw: string, required: boolean): Parsed =>
    raw.trim() === '' ? (required ? { error: REQUIRED } : { value: undefined }) : parseScalar(spec, raw);

function initialTexts(fields: PointField[], point: Point | null) {
    const texts: Record<string, string> = {};
    for (const field of fields) {
        const value = point?.[field.name];
        if (field.kind === 'vector') {
            field.axes.forEach((_, i) => (texts[axisKey(field.name, i)] = textOf((value as unknown[] | null)?.[i])));
        } else if (field.kind === 'scalar') {
            texts[field.name] = textOf(value);
        }
    }
    return texts;
}

let nextRow = 0;
function initialRows(fields: PointField[], point: Point | null) {
    return Object.fromEntries(
        fields.flatMap((field) =>
            field.kind === 'records'
                ? [
                      [
                          field.name,
                          ((point?.[field.name] as Point[] | null | undefined) ?? []).map((record): RecordRow => ({
                              id: nextRow++,
                              rest: record,
                              texts: Object.fromEntries(field.fields.map((f) => [f.name, textOf(record[f.name])])),
                          })),
                      ],
                  ]
                : []
        )
    ) as Record<string, RecordRow[]>;
}

/** The point the drafts make on top of `point`, or the error of each draft that does not parse. */
function pointFrom(
    fields: PointField[],
    point: Point | null,
    texts: Record<string, string>,
    rows: Record<string, RecordRow[]>
) {
    const next: Point = { ...point };
    const errors: Record<string, string> = {};
    const take = (key: string, result: Parsed) => {
        if ('error' in result) errors[key] = result.error;
        return 'error' in result ? undefined : result.value;
    };
    const put = (name: string, value: unknown) => {
        if (value === undefined) delete next[name];
        else next[name] = value;
    };
    for (const field of fields) {
        if (field.kind === 'vector') {
            const keys = field.axes.map((_, i) => axisKey(field.name, i));
            const empty = keys.every((key) => texts[key].trim() === '');
            const values = keys.map((key) => take(key, parsed(field.item, texts[key], field.required || !empty)));
            put(field.name, empty && !field.required ? undefined : values);
        } else if (field.kind === 'records') {
            const records = rows[field.name].map((row) => ({
                ...row.rest,
                ...Object.fromEntries(
                    field.fields.map((f) => [
                        f.name,
                        take(recordKey(field.name, row.id, f.name), parsed(f.spec, row.texts[f.name], true)),
                    ])
                ),
            }));
            put(field.name, records.length === 0 && !Array.isArray(point?.[field.name]) ? undefined : records);
        } else {
            put(field.name, take(field.name, parsed(field.spec, texts[field.name], field.required)));
        }
    }
    return { next, errors };
}

/** The drafts of a point's fields, from the schema's point fields over `point`, and the point they make. */
export function usePointDraft(point: Point | null) {
    const fields = pointFieldsOf();
    const [texts, setTexts] = useState(() => initialTexts(fields, point));
    const [rows, setRows] = useState(() => initialRows(fields, point));
    const [errors, setErrors] = useState<Record<string, string>>({});

    const clearError = (key: string) =>
        setErrors((current) => Object.fromEntries(Object.entries(current).filter(([k]) => k !== key)));
    return {
        fields,
        texts,
        rows,
        errors,
        setText: (key: string) => (value: string) => {
            setTexts((current) => ({ ...current, [key]: value }));
            clearError(key);
        },
        setRecordText: (name: string, id: number, field: string) => (value: string) => {
            setRows((current) => ({
                ...current,
                [name]: current[name].map((r) => (r.id === id ? { ...r, texts: { ...r.texts, [field]: value } } : r)),
            }));
            clearError(recordKey(name, id, field));
        },
        addRecord: (field: Extract<PointField, { kind: 'records' }>) =>
            setRows((current) => ({
                ...current,
                [field.name]: [
                    ...current[field.name],
                    { id: nextRow++, rest: {}, texts: Object.fromEntries(field.fields.map((f) => [f.name, ''])) },
                ],
            })),
        removeRecord: (name: string, id: number) =>
            setRows((current) => ({ ...current, [name]: current[name].filter((r) => r.id !== id) })),
        /** The point the drafts make, or null after marking each draft that does not parse. */
        build(): Point | null {
            const { next, errors: found } = pointFrom(fields, point, texts, rows);
            setErrors(found);
            return Object.keys(found).length === 0 ? next : null;
        },
    };
}

export type PointDraft = ReturnType<typeof usePointDraft>;
