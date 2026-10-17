import type { SlotNode } from '../model/record';

/** A slot's value as the inspector writes it. */
export function formatValue(slot: SlotNode): string {
    const value = slot.value;
    if (!value) return 'not in the record';
    if (value.extraction_status === 'not_reported') {
        return value.unreported_reason ? `not reported (${value.unreported_reason})` : 'not reported';
    }
    if (value.value === null || value.value === undefined) return '—';
    return typeof value.value === 'object' ? JSON.stringify(value.value) : String(value.value);
}
