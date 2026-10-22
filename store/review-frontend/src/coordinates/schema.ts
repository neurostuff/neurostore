import { fromSchema, schemaOf } from '../contract/schemas';
import { scalarOf, textOf, type Scalar } from '../inspector/schema';
import type { ReviewBundle } from '../contract/generated/review-bundle';
import { wrapperSpec } from '../inspector/schema';
import { asSchema, branchesOf, extractionSchema, listClassesAt, wrapperSchemaAt, type Schema } from '../model/schema';
import { inWords } from '../model/labels';
import { ANALYSES, ANALYSIS_EDITS, POINTS, READ_FROM, RECORD_ANALYSES } from '../model/coordinates';

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
    const label = inWords(name);
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
            return spec ? [{ name: field, label: inWords(field), spec }] : [];
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

/** The closed choices of the slot `path` of the record's analyses, from the extraction record schema. */
export function recordAnalysisChoices(
    bundle: Pick<ReviewBundle, 'entities' | 'record'>,
    path: string
): Scalar | undefined {
    const root = extractionSchema();
    const study = bundle.entities.find((row) => row.parent === null);
    const [className] = study ? listClassesAt(root, study.schema_class, RECORD_ANALYSES, bundle.record) : [];
    const wrapper = className ? wrapperSchemaAt(root, className, path) : undefined;
    const spec = wrapper && wrapperSpec(root, wrapper).value;
    return spec?.kind === 'enum' ? { ...spec, open: false } : undefined;
}

/** The editors of an analysis's name, role and coordinate space; the role and space take only the schema's choices. */
export const analysisEditors = fromSchema('coordinate-parse', (schema) => {
    const fields = analysisFields(schema);
    const closedChoice = (field: string) => {
        const spec = fields[field];
        return spec?.kind === 'enum' ? { ...spec, open: false } : spec;
    };
    return { name: fields.name, roles: closedChoice('role'), spaces: closedChoice('coordinate_space') };
});
