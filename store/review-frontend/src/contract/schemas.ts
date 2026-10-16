import type { Schema } from '../inspector/schema';

export const SCHEMA_NAMES = ['extraction-record', 'coordinate-parse'] as const;

export type SchemaName = (typeof SCHEMA_NAMES)[number];

export type Schemas = Record<SchemaName, Schema>;

let loaded: Schemas | undefined;

export function setSchemas(schemas: Schemas) {
    loaded = schemas;
}

/** The study_schema schema `name`, as the server served it. */
export function schemaOf(name: SchemaName): Schema {
    if (!loaded) throw new Error('the study_schema schemas are not loaded');
    return loaded[name];
}

/** Fetches both schemas at once and makes them the ones schemaOf returns. */
export async function loadSchemas(getSchema: (name: SchemaName) => Promise<Schema>): Promise<Schemas> {
    const [extraction, coordinate] = await Promise.all([getSchema('extraction-record'), getSchema('coordinate-parse')]);
    const schemas: Schemas = { 'extraction-record': extraction, 'coordinate-parse': coordinate };
    setSchemas(schemas);
    return schemas;
}

/** `compute` of the schema `name`, recomputed only when another copy of it is loaded. */
export function fromSchema<T>(name: SchemaName, compute: (schema: Schema) => T): () => T {
    let seen: Schema | undefined;
    let value: T;
    return () => {
        const schema = schemaOf(name);
        if (schema !== seen) {
            value = compute(schema);
            seen = schema;
        }
        return value;
    };
}

/** `compute` of the schema `name` and `key`, recomputed for every key only when another copy of the schema is loaded. */
export function fromSchemaKeyed<K, T>(name: SchemaName, compute: (schema: Schema, key: K) => T): (key: K) => T {
    let seen: Schema | undefined;
    let values = new Map<K, T>();
    return (key) => {
        const schema = schemaOf(name);
        if (schema !== seen) {
            values = new Map();
            seen = schema;
        }
        if (!values.has(key)) values.set(key, compute(schema, key));
        return values.get(key)!;
    };
}
