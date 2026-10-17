import { referenceSlots } from '../contract/references';
import { schemaOf } from '../contract/schemas';
import { isObject, parsePath } from './paths';
import { isReferenceSlot } from './record';

export type Schema = { [key: string]: unknown };

export const extractionSchema = () => schemaOf('extraction-record');

export const asSchema = (value: unknown): Schema | undefined =>
    typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Schema) : undefined;

const defOf = (root: Schema, name: string): Schema | undefined => asSchema(asSchema(root.$defs)?.[name]);

/** The $defs names a schema holds, directly or among its anyOf options. */
export function refsOf(schema: Schema): string[] {
    const own = typeof schema.$ref === 'string' ? [schema.$ref.split('/').pop() ?? ''] : [];
    const options = Array.isArray(schema.anyOf)
        ? schema.anyOf.flatMap((option) => {
              const next = asSchema(option);
              return next ? refsOf(next) : [];
          })
        : [];
    return [...own, ...options];
}

/** The branches a schema allows, refs followed and null left out. */
export function branchesOf(root: Schema, schema: Schema): Schema[] {
    const target = typeof schema.$ref === 'string' ? defOf(root, schema.$ref.split('/').pop() ?? '') : undefined;
    const resolvedSchema = target ?? schema;
    if (Array.isArray(resolvedSchema.anyOf)) {
        return resolvedSchema.anyOf.flatMap((alternative) => {
            const next = asSchema(alternative);
            return next ? branchesOf(root, next) : [];
        });
    }
    return resolvedSchema.type === 'null' ? [] : [resolvedSchema];
}

export const propertyOf = (schema: Schema, attribute: string) => asSchema(asSchema(schema.properties)?.[attribute]);

/** The one value a property schema allows, when it is a const or a single-member enum. */
function singleValue(property: Schema): unknown {
    if ('const' in property) return property.const;
    return Array.isArray(property.enum) && property.enum.length === 1 ? property.enum[0] : undefined;
}

/** Whether `value` is an instance of the class `def`: its required keys and properties fit it, and no single-value property names another value. */
function fits(def: Schema, value: unknown): boolean {
    if (!isObject(value)) return false;
    const props = asSchema(def.properties) ?? {};
    const required = Array.isArray(def.required) ? (def.required as string[]) : [];
    if (!required.every((key) => key in value)) return false;
    return Object.entries(value).every(([key, item]) => {
        const property = asSchema(props[key]);
        if (!property) return false;
        const fixed = singleValue(property);
        return fixed === undefined || fixed === item;
    });
}

/** Whether a class fixes one of the value's keys, by const or single-member enum, to the value's own value. */
function fixesKey(def: Schema, value: unknown): boolean {
    if (!isObject(value)) return false;
    const props = asSchema(def.properties) ?? {};
    return Object.entries(props).some(([key, property]) => {
        const fixed = singleValue(asSchema(property) ?? {});
        return key in value && fixed !== undefined && fixed === value[key];
    });
}

/**
 * The class among `names` that `value` is an instance of: the first that a key of the value fixes to its own value,
 * else the first whose required keys are present and whose properties cover the value and agree with its fixed keys,
 * else the first object class.
 */
export function pick(root: Schema, names: string[], value: unknown): string | undefined {
    const classes = names.filter((name) => defOf(root, name)?.type === 'object');
    const fixed = classes.find((name) => fixesKey(defOf(root, name)!, value));
    if (fixed !== undefined) return fixed;
    return classes.find((name) => fits(defOf(root, name)!, value)) ?? classes[0];
}

/** The class among those a property schema holds, directly or as its items, that `value` is an instance of. */
export function classOf(root: Schema, schema: Schema, value: unknown): string | undefined {
    const items = asSchema(schema.items);
    return pick(root, [...refsOf(schema), ...(items ? refsOf(items) : [])], value);
}

/** A value wrapper: a class with both an extraction status and evidence. */
const isWrapper = (def: Schema) => {
    const props = asSchema(def.properties) ?? {};
    return 'extraction_status' in props && 'evidence' in props;
};

const isEntity = (def: Schema) => 'local_id' in (asSchema(def.properties) ?? {});

/** The class definition a schema stands for at `value`: the one of its refs that fits it. */
function concrete(root: Schema, schema: Schema, value: unknown): Schema {
    const names = refsOf(schema);
    const name = names.length > 1 ? pick(root, names, value) : names[0];
    return (name !== undefined && defOf(root, name)) || schema;
}

/** The schema of the node at `path` on an item of `className`, each class choice made from the value there. */
function nodeAt(root: Schema, className: string, path: string, item: unknown): Schema | undefined {
    const start = defOf(root, className);
    if (!start) return undefined;
    let node = start;
    let value = item;
    for (const step of parsePath(path)) {
        node = concrete(root, node, value);
        const child = typeof step === 'number' ? asSchema(node.items) : propertyOf(node, step);
        if (!child) return undefined;
        value =
            typeof step === 'number'
                ? Array.isArray(value)
                    ? value[step]
                    : undefined
                : isObject(value)
                  ? value[step]
                  : undefined;
        node = child;
    }
    return concrete(root, node, value);
}

/** The ExtractedValue schema of the slot at `path` on an item of `className`. */
export function wrapperSchemaAt(root: Schema, className: string, path: string, item?: unknown): Schema | undefined {
    const node = nodeAt(root, className, path, item);
    return node && isWrapper(node) ? node : undefined;
}

/** The classes a list at `path` on an item of `className` holds. */
export function listClassesAt(root: Schema, className: string, path: string, item: unknown): string[] {
    const items = asSchema(nodeAt(root, className, path, item)?.items);
    return items ? refsOf(items).filter((name) => defOf(root, name)?.type === 'object') : [];
}

export const titleOf = (root: Schema, name: string) => (defOf(root, name)?.title as string | undefined) ?? name;

const NOT_REPORTED = { extraction_status: 'not_reported', evidence: { status: 'not_applicable' } };

/** The values a new entity of a class needs: each required wrapper not reported, each required single-value attribute its value. */
export function requiredDefaults(root: Schema, className: string): Record<string, unknown> {
    const def = defOf(root, className);
    const props = asSchema(def?.properties) ?? {};
    const required = Array.isArray(def?.required) ? (def?.required as string[]) : [];
    return Object.fromEntries(
        required.flatMap((name): [string, unknown][] => {
            const branch = asSchema(props[name]);
            if (!branch || name === 'local_id') return [];
            if (isWrapper(concrete(root, branch, undefined))) return [[name, { ...NOT_REPORTED }]];
            const fixed = singleValue(branch);
            return fixed === undefined ? [] : [[name, fixed]];
        })
    );
}

export interface DeclaredAttribute {
    path: string;
    wrapper?: Schema;
}

/** The attributes a class declares, by path, walking into nested objects that are not entities. */
export function declaredAttributes(root: Schema, className: string): DeclaredAttribute[] {
    const visit = (node: Schema, prefix: string, seen: string[]): DeclaredAttribute[] =>
        Object.entries(asSchema(node.properties) ?? {}).flatMap(([attribute, property]): DeclaredAttribute[] => {
            const path = prefix ? `${prefix}.${attribute}` : attribute;
            const branch = asSchema(property);
            if (!branch) return [];
            const def = concrete(root, branch, undefined);
            if (isWrapper(def)) return [{ path, wrapper: def }];
            const names = refsOf(branch);
            const target = names.length === 1 && !seen.includes(names[0]) ? defOf(root, names[0]) : undefined;
            if (target?.type === 'object' && !isEntity(target)) return visit(target, path, [...seen, names[0]]);
            return [{ path }];
        });
    const start = defOf(root, className);
    return start ? visit(start, '', [className]) : [];
}

/** The class a reference slot links to, from referenceSlots() (the x-reference annotations), by the rule record.ts gives the slot. */
export function referenceTarget(row: { entity_class: string; schema_class: string }, path: string): string | undefined {
    const steps = parsePath(path);
    const attribute = steps.filter((step): step is string => typeof step === 'string').at(-1);
    if (attribute === undefined) return undefined;
    const nested = steps.length > 1;
    if (!isReferenceSlot(row, nested, attribute)) return undefined;
    const owners = [row.schema_class, row.entity_class];
    return referenceSlots().find((r) => r.slot === attribute && (nested || owners.includes(r.class)))?.target;
}
