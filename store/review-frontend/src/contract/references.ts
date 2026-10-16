import type { Schema } from '../inspector/schema';
import { fromSchema } from './schemas';

export interface Reference {
    class: string;
    slot: string;
    target: string;
    multivalued: boolean;
}

export function referenceSlotsOf(schema: Schema): Reference[] {
    const defs = schema.$defs as Record<string, { properties?: Record<string, unknown> }>;
    return Object.entries(defs)
        .flatMap(([cls, definition]) =>
            Object.entries(definition.properties ?? {}).flatMap(([slot, prop]): Reference[] => {
                const property = prop as { 'x-reference'?: string; items?: unknown };
                if (typeof property['x-reference'] !== 'string') return [];
                return [{ class: cls, slot, target: property['x-reference'], multivalued: 'items' in property }];
            })
        )
        .sort((a, b) => a.class.localeCompare(b.class) || a.slot.localeCompare(b.slot));
}

/** Each extraction-schema property that carries x-reference, with the class it links to. */
export const referenceSlots = fromSchema('extraction-record', referenceSlotsOf);
