import type { SlotNode } from '../model/record';
import { inWords } from '../model/labels';
import { formatValue } from '../model/valueText';

const itemText = (item: unknown) =>
    item !== null && typeof item === 'object'
        ? Object.entries(item)
              .map(([key, value]) => `${inWords(key)}: ${String(value)}`)
              .join(', ')
        : String(item);

/** A slot's value as the reviewer reads it: a list as its items, anything else as text. */
export function ValueView({ slot }: { slot: SlotNode }) {
    const value = slot.value?.extraction_status === 'extracted' ? slot.value.value : undefined;
    if (!Array.isArray(value)) return <>{formatValue(slot)}</>;
    if (value.length === 0) return <>—</>;
    return (
        <ul className="rv-values">
            {value.map((item, i) => (
                <li key={i}>{itemText(item)}</li>
            ))}
        </ul>
    );
}
