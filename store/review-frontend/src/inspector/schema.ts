import { asSchema, branchesOf, propertyOf, type Schema } from '../model/schema';

export type Scalar =
    | { kind: 'text'; minLength?: number; maxLength?: number; pattern?: string }
    | {
          kind: 'number';
          integer: boolean;
          minimum?: number;
          maximum?: number;
          exclusiveMinimum?: number;
          exclusiveMaximum?: number;
      }
    | { kind: 'boolean' }
    | { kind: 'enum'; options: string[]; open: boolean };

export type EditorSpec = Scalar | { kind: 'list'; item: Scalar };

export interface WrapperSpec {
    value?: EditorSpec;
    statuses: string[];
    reasons: string[];
    sources: string[];
}

export type Parsed = { value: unknown } | { error: string };

const EMPTY = 'enter a value, or set the status to not reported';
const NUMBER_BOUNDS = ['minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum'] as const;
const TEXT_BOUNDS = ['minLength', 'maxLength'] as const;

export const textOf = (value: unknown) => (value === null || value === undefined ? '' : String(value));

const typesOf = (schema: Schema): string[] =>
    (Array.isArray(schema.type) ? schema.type : schema.type ? [schema.type] : []).filter((t) => t !== 'null');

const enumOf = (root: Schema, schema: Schema | undefined): string[] =>
    schema
        ? branchesOf(root, schema).flatMap((b) =>
              Array.isArray(b.enum) ? b.enum.filter((v): v is string => typeof v === 'string') : []
          )
        : [];

const bounds = <K extends string>(schema: Schema, keys: readonly K[]) =>
    Object.fromEntries(keys.filter((key) => typeof schema[key] === 'number').map((key) => [key, schema[key]])) as {
        [P in K]?: number;
    };

/** The scalar editor a schema calls for; undefined when it is not a scalar. */
export function scalarOf(root: Schema, schema: Schema): Scalar | undefined {
    const typed = branchesOf(root, schema).filter((b) => !Array.isArray(b.enum));
    const options = enumOf(root, schema);
    if (options.length) return { kind: 'enum', options, open: typed.some((b) => typesOf(b).includes('string')) };
    for (const b of typed) {
        const types = typesOf(b);
        if (types.includes('boolean')) return { kind: 'boolean' };
        if (types.includes('integer')) return { kind: 'number', integer: true, ...bounds(b, NUMBER_BOUNDS) };
        if (types.includes('number')) return { kind: 'number', integer: false, ...bounds(b, NUMBER_BOUNDS) };
        if (types.includes('string')) {
            return {
                kind: 'text',
                ...bounds(b, TEXT_BOUNDS),
                ...(typeof b.pattern === 'string' ? { pattern: b.pattern } : {}),
            };
        }
    }
    return undefined;
}

/** The editor a value schema calls for; undefined when the schema allows any value. */
export function editorFor(root: Schema, value: Schema): EditorSpec | undefined {
    for (const schema of branchesOf(root, value)) {
        const items = asSchema(schema.items);
        if (typesOf(schema).includes('array') && items) {
            const item = scalarOf(root, items);
            return item && { kind: 'list', item };
        }
    }
    return scalarOf(root, value);
}

/** The editor for a value of no schema, from the value itself. */
export function inferredEditor(value: unknown): EditorSpec {
    const scalar = (v: unknown): Scalar =>
        typeof v === 'number'
            ? { kind: 'number', integer: Number.isInteger(v) }
            : typeof v === 'boolean'
              ? { kind: 'boolean' }
              : { kind: 'text' };
    return Array.isArray(value) ? { kind: 'list', item: scalar(value[0]) } : scalar(value);
}

export function wrapperSpec(root: Schema, wrapper: Schema): WrapperSpec {
    const value = propertyOf(wrapper, 'value');
    return {
        value: value && editorFor(root, value),
        statuses: enumOf(root, propertyOf(wrapper, 'extraction_status')),
        reasons: enumOf(root, propertyOf(wrapper, 'unreported_reason')),
        sources: enumOf(root, propertyOf(wrapper, 'value_source')),
    };
}

function numberError(spec: Extract<Scalar, { kind: 'number' }>, value: number): string | undefined {
    if (!Number.isFinite(value)) return 'must be a number';
    if (spec.integer && !Number.isInteger(value)) return 'must be a whole number';
    if (spec.minimum !== undefined && value < spec.minimum) return `must be at least ${spec.minimum}`;
    if (spec.maximum !== undefined && value > spec.maximum) return `must be at most ${spec.maximum}`;
    if (spec.exclusiveMinimum !== undefined && value <= spec.exclusiveMinimum) {
        return `must be more than ${spec.exclusiveMinimum}`;
    }
    if (spec.exclusiveMaximum !== undefined && value >= spec.exclusiveMaximum) {
        return `must be less than ${spec.exclusiveMaximum}`;
    }
    return undefined;
}

function textError(spec: Extract<Scalar, { kind: 'text' }>, value: string): string | undefined {
    if (spec.minLength !== undefined && value.length < spec.minLength) {
        return `must be at least ${spec.minLength} characters`;
    }
    if (spec.maxLength !== undefined && value.length > spec.maxLength) {
        return `must be at most ${spec.maxLength} characters`;
    }
    if (spec.pattern !== undefined && !new RegExp(spec.pattern, 'u').test(value)) return `must match ${spec.pattern}`;
    return undefined;
}

/** The value typed as `raw`, or the schema constraint it breaks. */
export function parseScalar(spec: Scalar, raw: string): Parsed {
    const text = spec.kind === 'text' ? raw : raw.trim();
    if (text.trim() === '') return { error: EMPTY };
    const result = (value: unknown, error: string | undefined): Parsed => (error ? { error } : { value });
    switch (spec.kind) {
        case 'number': {
            const value = Number(text);
            return result(value, numberError(spec, value));
        }
        case 'text':
            return result(text, textError(spec, text));
        case 'boolean':
            return text === 'true' || text === 'false'
                ? { value: text === 'true' }
                : { error: 'must be true or false' };
        case 'enum':
            return spec.open || spec.options.includes(text)
                ? { value: text }
                : { error: `must be one of: ${spec.options.join(', ')}` };
    }
}
