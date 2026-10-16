import type { Schemas } from '../contract/schemas';
import type { Schema } from '../inspector/schema';
import coordinateSchema from './golden/schemas/coordinate-parse.schema.json';
import extractionSchema from './golden/schemas/extraction-record.schema.json';

/** The schemas the backend serves, as its golden test last wrote them. */
export const GOLDEN_SCHEMAS: Schemas = {
    'extraction-record': extractionSchema as Schema,
    'coordinate-parse': coordinateSchema as Schema,
};

/** The golden schema `name`, or undefined when the backend serves no schema of that name. */
export const schemaByName = (name: string): Schema | undefined =>
    name in GOLDEN_SCHEMAS ? GOLDEN_SCHEMAS[name as keyof Schemas] : undefined;
