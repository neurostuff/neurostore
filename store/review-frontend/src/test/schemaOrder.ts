import type { Schemas } from '../contract/schemas';
import type { Schema } from '../model/schema';

/** The schemas with the properties of `className` in the order `order` names them, the others after them. */
export function withPropertyOrder(schemas: Schemas, className: string, order: string[]): Schemas {
    const root = schemas['extraction-record'];
    const defs = root.$defs as Record<string, Schema & { properties: Record<string, unknown> }>;
    const def = defs[className];
    const names = [...order.filter((name) => name in def.properties), ...Object.keys(def.properties)];
    const properties = Object.fromEntries([...new Set(names)].map((name) => [name, def.properties[name]]));
    return {
        ...schemas,
        'extraction-record': { ...root, $defs: { ...defs, [className]: { ...def, properties } } },
    };
}
