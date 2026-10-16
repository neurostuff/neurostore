import { fromSchemaKeyed } from '../contract/schemas';
import { declaredAttributes } from '../inspector/schema';

const declaredIn = fromSchemaKeyed('extraction-record', (schema, schemaClass: string) =>
    declaredAttributes(schema, schemaClass).map(({ path, wrapper }) => ({ path, wrapper }))
);
/** The attributes a row's class declares, from the extraction record schema. */
export const declaredOf = (row: { schema_class: string }) => declaredIn(row.schema_class);
