import type { EntityNode, RecordIndex, SlotNode } from './record';
import { slotKey } from './targetKey';

/** The slot of a list item giving the number of participants an analysis analysed of the group the item names. */
const COUNT_SLOT = 'n';

export interface AnalysedCount {
    analysis: EntityNode;
    /** The slot holding the count. */
    slot: SlotNode;
    n: unknown;
}

const NONE: AnalysedCount[] = [];
const countsOf = new WeakMap<RecordIndex, Map<string, AnalysedCount[]>>();

/** The counts of every entity counted, by the entity: from each list item that links to it beside a count. */
function allCounts(index: RecordIndex): Map<string, AnalysedCount[]> {
    const counts = new Map<string, AnalysedCount[]>();
    for (const analysis of index.entities) {
        for (const slot of analysis.slots) {
            const item = slot.kind === 'reference' ? /^(.*\[#\d+\])\.[^.[]+$/.exec(slot.path)?.[1] : undefined;
            if (!item) continue;
            const count = index.slot(slotKey(analysis.id, `${item}.${COUNT_SLOT}`));
            const n = count?.value?.extraction_status === 'extracted' ? count.value.value : undefined;
            if (!count || n === undefined) continue;
            for (const entity of slot.references)
                counts.set(entity, [...(counts.get(entity) ?? []), { analysis, slot: count, n }]);
        }
    }
    return counts;
}

/** The n each entity analysed of `entity`, in index order; worked out once for each index. */
export function analysedCounts(index: RecordIndex, entity: string): AnalysedCount[] {
    let counts = countsOf.get(index);
    if (!counts) countsOf.set(index, (counts = allCounts(index)));
    return counts.get(entity) ?? NONE;
}
