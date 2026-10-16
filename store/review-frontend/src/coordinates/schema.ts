import { schemaOf } from '../contract/schemas';
import { asSchema, branchesOf, scalarOf, textOf, type Scalar, type Schema } from '../inspector/schema';
import { ANALYSES, ANALYSIS_EDITS, POINTS, READ_FROM } from '../model/coordinates';

export const coordinateSchema = () => schemaOf('coordinate-parse');

export type PointField =
    | { name: string; label: string; kind: 'vector'; axes: string[]; item: Scalar; required: boolean }
    | { name: string; label: string; kind: 'records'; fields: RecordField[]; required: boolean }
    | { name: string; label: string; kind: 'scalar'; spec: Scalar; required: boolean };

export interface RecordField {
    name: string;
    label: string;
    spec: Scalar;
}

export interface GridColumn {
    label: string;
    text(point: Record<string, unknown>): string;
}

const AXES = ['x', 'y', 'z'];

const propertiesOf = (schema: Schema | undefined) => Object.entries(asSchema(schema?.properties) ?? {});
const requiredOf = (schema: Schema | undefined) => (Array.isArray(schema?.required) ? schema.required : []);
const labelOf = (name: string) => name.replace(/_/g, ' ');

/** The class of the items of the list `property` on `node`. */
function itemClass(root: Schema, node: Schema | undefined, property: string): Schema | undefined {
    const list = asSchema(asSchema(node?.properties)?.[property]);
    for (const branch of list ? branchesOf(root, list) : []) {
        const items = asSchema(branch.items);
        if (items) return branchesOf(root, items).find((candidate) => candidate.type === 'object');
    }
    return undefined;
}

const analysisClass = (root: Schema) => itemClass(root, root, ANALYSES);
const pointClass = (root: Schema) => itemClass(root, analysisClass(root), POINTS);

const axesOf = (length: number) => (length === AXES.length ? AXES : Array.from({ length }, (_, i) => String(i + 1)));

function fieldOf(root: Schema, name: string, property: Schema, required: boolean): PointField | undefined {
    const label = labelOf(name);
    for (const branch of branchesOf(root, property)) {
        const items = asSchema(branch.items);
        if (!items) continue;
        const item = scalarOf(root, items);
        if (item && typeof branch.minItems === 'number' && branch.minItems === branch.maxItems) {
            return { name, label, kind: 'vector', axes: axesOf(branch.minItems), item, required };
        }
        const record = branchesOf(root, items).find((candidate) => candidate.type === 'object');
        if (!record) return undefined;
        const fields = propertiesOf(record).flatMap(([field, schema]): RecordField[] => {
            const spec = requiredOf(record).includes(field) ? scalarOf(root, asSchema(schema) ?? {}) : undefined;
            return spec ? [{ name: field, label: labelOf(field), spec }] : [];
        });
        return { name, label, kind: 'records', fields, required };
    }
    const spec = scalarOf(root, property);
    return spec && { name, label, kind: 'scalar', spec, required };
}

const SCALAR_RANK: Record<Scalar['kind'], number> = { number: 2, enum: 3, text: 4, boolean: 5 };
const rankOf = (field: PointField) =>
    field.kind === 'vector' ? 0 : field.kind === 'records' ? 1 : SCALAR_RANK[field.spec.kind];

/** The fields a reviewer edits on a point, from the schema's point class: lists first, then numbers, choices, text and switches. */
export function pointFields(root: Schema = coordinateSchema()): PointField[] {
    const point = pointClass(root);
    const fields = propertiesOf(point).flatMap(([name, property]) => {
        const schema = asSchema(property);
        const field =
            schema && !READ_FROM.includes(name) && fieldOf(root, name, schema, requiredOf(point).includes(name));
        return field ? [field] : [];
    });
    return fields
        .map((field, order) => ({ field, order }))
        .sort((a, b) => rankOf(a.field) - rankOf(b.field) || a.order - b.order)
        .map(({ field }) => field);
}

/** The grid's columns: each axis, each list of records, then each number and free text a point holds. */
export function gridColumns(fields: PointField[]): GridColumn[] {
    return fields.flatMap((field): GridColumn[] => {
        if (field.kind === 'vector') {
            return field.axes.map((axis, i) => ({
                label: axis,
                text: (point) => textOf((point[field.name] as unknown[] | undefined)?.[i]),
            }));
        }
        if (field.kind === 'records') {
            return [
                {
                    label: field.label,
                    text: (point) =>
                        ((point[field.name] as Record<string, unknown>[] | null | undefined) ?? [])
                            .map((record) => field.fields.map((f) => textOf(record[f.name])).join(' '))
                            .join(', '),
                },
            ];
        }
        const shown = field.spec.kind === 'number' || field.spec.kind === 'text';
        return shown ? [{ label: field.label, text: (point) => textOf(point[field.name]) }] : [];
    });
}

/** The editors for what a reviewer gives an analysis, from the schema's analysis class. */
export function analysisFields(root: Schema = coordinateSchema()): Record<string, Scalar> {
    const analysis = analysisClass(root);
    const properties = asSchema(analysis?.properties) ?? {};
    return Object.fromEntries(
        ANALYSIS_EDITS.flatMap((name) => {
            const spec = scalarOf(root, asSchema(properties[name]) ?? {});
            return spec ? [[name, spec]] : [];
        })
    );
}
