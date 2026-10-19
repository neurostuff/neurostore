import { referenceSlots, type Reference } from '../contract/references';
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

const propertyRanks = new WeakMap<Schema, Map<string, number>>();

/** Where `name` comes among the properties `def` declares; after them all when it declares no such property. */
function rankIn(def: Schema, name: string): number {
    let ranks = propertyRanks.get(def);
    if (!ranks)
        propertyRanks.set(def, (ranks = new Map(Object.keys(asSchema(def.properties) ?? {}).map((k, i) => [k, i]))));
    return ranks.get(name) ?? ranks.size;
}

/**
 * Where the slot at `path` comes among the slots of an item of `className`: at each step, the place of its property
 * in the class declaring it, or its index in the list; compared step by step.
 */
export function slotRank(root: Schema, className: string, path: string, item: unknown): number[] {
    let node = defOf(root, className);
    let value = item;
    return parsePath(path).map((step) => {
        if (!node) return Number.MAX_SAFE_INTEGER;
        const def = concrete(root, node, value);
        if (typeof step === 'number') {
            node = asSchema(def.items);
            value = Array.isArray(value) ? value[step] : undefined;
            return step;
        }
        node = propertyOf(def, step);
        value = isObject(value) ? value[step] : undefined;
        return rankIn(def, step);
    });
}

/** Orders two slot ranks step by step, a rank before the longer ones it begins. */
export function compareRanks(a: number[], b: number[]): number {
    for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] - b[i];
    return a.length - b.length;
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

/** A required reference a skeleton could not fill: its path on the new entity and the class it links to. */
export interface OpenReference {
    path: string;
    target: string;
}

export interface Skeleton {
    entity: Record<string, unknown>;
    open: OpenReference[];
}

const hasType = (schema: Schema, type: string) =>
    schema.type === type || (Array.isArray(schema.type) && schema.type.includes(type));

/** The class definition a property stands for, its anyOf or oneOf branch the one `sibling` is an instance of, else the first. */
function branchFor(root: Schema, property: Schema, sibling: unknown): Schema {
    const options = Array.isArray(property.oneOf) ? { anyOf: property.oneOf } : property;
    return concrete(root, options, sibling);
}

/**
 * A value of `property` the schema takes, with what `sibling` holds at the same place to copy references and
 * branches from; undefined where it can make none, a reference it cannot fill added to `open`.
 */
function skeletonAt(root: Schema, property: Schema, sibling: unknown, path: string, open: OpenReference[]): unknown {
    const target = property['x-reference'];
    if (typeof target === 'string') {
        if (hasType(property, 'array')) return [];
        if (typeof sibling === 'string') return sibling;
        open.push({ path, target });
        return undefined;
    }
    const fixed = singleValue(property);
    if (fixed !== undefined) return fixed;
    const def = branchFor(root, property, sibling);
    if (isWrapper(def)) return { ...NOT_REPORTED };
    if (hasType(def, 'array')) {
        const items = asSchema(def.items);
        if (!items || typeof def.minItems !== 'number') return [];
        return Array.from({ length: def.minItems }, (_, i) =>
            skeletonAt(root, items, Array.isArray(sibling) ? sibling[i] : undefined, `${path}[#${i}]`, open)
        );
    }
    return hasType(def, 'object') ? objectSkeleton(root, def, sibling, path, open) : undefined;
}

function objectSkeleton(root: Schema, def: Schema, sibling: unknown, prefix: string, open: OpenReference[]) {
    const props = asSchema(def.properties) ?? {};
    const required = Array.isArray(def.required) ? (def.required as string[]) : [];
    return Object.fromEntries(
        required.flatMap((name): [string, unknown][] => {
            const property = asSchema(props[name]);
            if (!property || name === 'local_id') return [];
            const path = prefix ? `${prefix}.${name}` : name;
            const value = skeletonAt(root, property, isObject(sibling) ? sibling[name] : undefined, path, open);
            return value === undefined ? [] : [[name, value]];
        })
    );
}

/**
 * A new entity of a class, as the schema takes it: each required wrapper not reported, list empty (or its least
 * size of skeleton items), object its own skeleton, single-value attribute its value, union the branch `sibling`
 * takes (else the first), and reference what `sibling` holds there; the required references it could not fill open.
 */
export function skeletonOf(root: Schema, className: string, sibling?: unknown): Skeleton {
    const open: OpenReference[] = [];
    const def = defOf(root, className);
    return { entity: def ? objectSkeleton(root, def, sibling, '', open) : {}, open };
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

/** The reference slot at `path` of an entity of `row`'s classes, from referenceSlots(), by the rule record.ts gives the slot. */
export function referenceSlotOf(
    row: { entity_class: string; schema_class: string },
    path: string
): Reference | undefined {
    const steps = parsePath(path);
    const attribute = steps.filter((step): step is string => typeof step === 'string').at(-1);
    if (attribute === undefined) return undefined;
    const nested = steps.length > 1;
    if (!isReferenceSlot(row, nested, attribute)) return undefined;
    const owners = [row.schema_class, row.entity_class];
    return referenceSlots().find((r) => r.slot === attribute && (nested || owners.includes(r.class)));
}

/** The class a reference slot links to. */
export const referenceTarget = (row: { entity_class: string; schema_class: string }, path: string) =>
    referenceSlotOf(row, path)?.target;
