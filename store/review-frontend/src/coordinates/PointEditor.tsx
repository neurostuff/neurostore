import CancelIcon from '@mui/icons-material/Cancel';
import { Box, Button, IconButton, Stack, Typography } from '@mui/material';
import { useId, useState, type ReactNode } from 'react';
import { panelKeys } from '../inspector/panelKeys';
import { parseScalar, textOf, type Parsed, type Scalar } from '../inspector/schema';
import { ScalarField } from '../inspector/SlotEditor';
import { COORDINATE_SCHEMA, pointFields, type PointField } from './schema';

type Point = Record<string, unknown>;

export interface PointEditorProps {
    label: string;
    /** The point as the revision holds it; null for a new point. */
    point: Point | null;
    onSave(point: Point): void;
    onCancel(): void;
    saveLabel?: string;
    /** Whether the point's first field takes the focus. */
    autoFocus?: boolean;
    /** Fields shown above the point's, which the caller saves with it. */
    children?: ReactNode;
}

interface RecordRow {
    id: number;
    texts: Record<string, string>;
    rest: Point;
}

const POINT_FIELDS = pointFields(COORDINATE_SCHEMA);
const REQUIRED = 'required';

const axisKey = (name: string, i: number) => `${name}.${i}`;
const recordKey = (name: string, row: number, field: string) => `${name}.${row}.${field}`;

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

/** An editor for one coordinate point, generated from the schema's point fields. */
export function PointEditor({
    label,
    point,
    onSave,
    onCancel,
    saveLabel = 'Save',
    autoFocus = true,
    children,
}: PointEditorProps) {
    const id = useId();
    const [texts, setTexts] = useState(() => initialTexts(POINT_FIELDS, point));
    const [rows, setRows] = useState(() => initialRows(POINT_FIELDS, point));
    const [errors, setErrors] = useState<Record<string, string>>({});

    const clearError = (key: string) =>
        setErrors((current) => Object.fromEntries(Object.entries(current).filter(([k]) => k !== key)));
    const setText = (key: string) => (value: string) => {
        setTexts((current) => ({ ...current, [key]: value }));
        clearError(key);
    };
    const setRecordText = (name: string, id: number, field: string) => (value: string) => {
        setRows((current) => ({
            ...current,
            [name]: current[name].map((r) => (r.id === id ? { ...r, texts: { ...r.texts, [field]: value } } : r)),
        }));
        clearError(recordKey(name, id, field));
    };
    const save = () => {
        const { next, errors: found } = pointFrom(POINT_FIELDS, point, texts, rows);
        setErrors(found);
        if (Object.keys(found).length === 0) onSave(next);
    };

    const fieldProps = (key: string, fieldLabel: string, autoFocus = false) => ({
        id: `${id}-${key}`,
        label: fieldLabel,
        error: errors[key] ?? '',
        autoFocus,
        value: texts[key] ?? '',
        onChange: setText(key),
    });

    return (
        <Stack
            role="group"
            aria-label={`edit ${label}`}
            spacing={1.5}
            sx={{ py: 1 }}
            onKeyDown={panelKeys(save, onCancel)}
        >
            {children}
            {POINT_FIELDS.map((field, order) => {
                if (field.kind === 'vector') {
                    return (
                        <Stack key={field.name} direction="row" spacing={1}>
                            {field.axes.map((axis, i) => (
                                <ScalarField
                                    key={axis}
                                    spec={field.item}
                                    {...fieldProps(axisKey(field.name, i), axis, autoFocus && order === 0 && i === 0)}
                                />
                            ))}
                        </Stack>
                    );
                }
                if (field.kind === 'records') {
                    return (
                        <Box key={field.name}>
                            <Typography variant="caption" color="text.secondary" component="div">
                                {field.label}
                            </Typography>
                            <Stack role="list" aria-label={field.label} spacing={1} sx={{ my: 1 }}>
                                {rows[field.name].map((row, i) => (
                                    <Stack
                                        key={row.id}
                                        role="listitem"
                                        direction="row"
                                        spacing={1}
                                        alignItems="flex-start"
                                    >
                                        {field.fields.map((f) => (
                                            <ScalarField
                                                key={f.name}
                                                spec={f.spec}
                                                id={`${id}-${recordKey(field.name, row.id, f.name)}`}
                                                label={`${f.label} ${i + 1}`}
                                                error={errors[recordKey(field.name, row.id, f.name)] ?? ''}
                                                autoFocus={false}
                                                value={row.texts[f.name]}
                                                onChange={setRecordText(field.name, row.id, f.name)}
                                            />
                                        ))}
                                        <IconButton
                                            size="small"
                                            aria-label={`remove ${field.label} ${i + 1}`}
                                            onClick={() =>
                                                setRows((current) => ({
                                                    ...current,
                                                    [field.name]: current[field.name].filter((r) => r.id !== row.id),
                                                }))
                                            }
                                        >
                                            <CancelIcon fontSize="small" />
                                        </IconButton>
                                    </Stack>
                                ))}
                            </Stack>
                            <Button
                                size="small"
                                onClick={() =>
                                    setRows((current) => ({
                                        ...current,
                                        [field.name]: [
                                            ...current[field.name],
                                            {
                                                id: nextRow++,
                                                rest: {},
                                                texts: Object.fromEntries(field.fields.map((f) => [f.name, ''])),
                                            },
                                        ],
                                    }))
                                }
                            >
                                {`add ${field.label}`}
                            </Button>
                        </Box>
                    );
                }
                return (
                    <ScalarField
                        key={field.name}
                        spec={field.spec}
                        optional={!field.required}
                        {...fieldProps(field.name, field.label)}
                    />
                );
            })}
            <Stack direction="row" spacing={1}>
                <Button size="small" variant="contained" onClick={save}>
                    {saveLabel}
                </Button>
                <Button size="small" onClick={onCancel}>
                    Cancel
                </Button>
            </Stack>
        </Stack>
    );
}
