import { inWords } from './labels';
import { leafOf } from './paths';
import type { RecordIndex, SlotNode } from './record';
import { VALUE_WORDS } from './cardTemplates';

const looksLikeToken = (value: string) => /^[a-z][a-z0-9_]*$/.test(value) && value.includes('_');

/** One value of a slot in words: a boolean as yes or no, a closed value by `VALUE_WORDS` or its words. */
function wordsFor(attribute: string, value: unknown): string {
    if (typeof value === 'boolean') return value ? 'yes' : 'no';
    if (typeof value !== 'string')
        return typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value);
    return (
        VALUE_WORDS[`${attribute}:${value}`] ?? VALUE_WORDS[value] ?? (looksLikeToken(value) ? inWords(value) : value)
    );
}

/** A slot's value as the record has it: not in the record, not reported with its reason, a list joined with `;`. */
export function formatValue(slot: SlotNode): string {
    const value = slot.value;
    if (!value) return 'not in the record';
    if (value.extraction_status === 'not_reported') {
        return value.unreported_reason ? `not reported (${value.unreported_reason})` : 'not reported';
    }
    if (value.value === null || value.value === undefined) return '—';
    if (Array.isArray(value.value)) return value.value.map(String).join('; ');
    return typeof value.value === 'object' ? JSON.stringify(value.value) : String(value.value);
}

/**
 * A slot's value as a card says it: references by the names of their entities, closed values in words, a list joined
 * by `join`; else as `formatValue` writes it.
 */
export function valueWords(index: RecordIndex, slot: SlotNode, join = ', '): string {
    if (slot.kind === 'reference')
        return slot.references.length ? slot.references.map((id) => index.entity(id)?.name ?? id).join(join) : 'none';
    const value = slot.value?.extraction_status === 'extracted' ? slot.value.value : undefined;
    if (value === undefined || value === null) return formatValue(slot);
    const attribute = leafOf(slot.path);
    return Array.isArray(value) ? value.map((v) => wordsFor(attribute, v)).join(join) : wordsFor(attribute, value);
}

/** A long or list value on one line: a list as how many items and its first. */
export function lineWords(index: RecordIndex, slot: SlotNode): string {
    const value = slot.value?.extraction_status === 'extracted' ? slot.value.value : undefined;
    if (Array.isArray(value) && value.length > 1)
        return `${value.length} items · ${wordsFor(leafOf(slot.path), value[0])}`;
    return valueWords(index, slot);
}
