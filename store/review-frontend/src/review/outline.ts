import type { Op } from '../contract/generated/review-ops';
import type { StatusId } from '../inspector/status';
import { isChange, type DiffStatus } from '../model/diff';
import { isDoubtful, type EntityNode } from '../model/record';
import { targetKey } from '../model/targetKey';
import type { OutlineFilter } from '../store/viewStore';

/** The target keys that carry a note: a note op, or a verdict with a note. */
export function notedKeys(ops: Op[]): Set<string> {
    return new Set(
        ops.flatMap((op) => (op.type === 'note' || (op.type === 'verdict' && op.note) ? [targetKey(op.target)] : []))
    );
}

/**
 * Whether the outline lists `entity` under `filter`. Changed is what the diff finds against the original,
 * or a review status of edited, added or rejected on the entity itself.
 */
export function outlineMatches(
    filter: OutlineFilter,
    entity: EntityNode,
    status: StatusId,
    noted: boolean,
    diff: DiffStatus
): boolean {
    switch (filter) {
        case 'all':
            return true;
        case 'unreviewed':
            return status === 'unchecked';
        case 'changed':
            return isChange(diff) || status === 'edited' || status === 'added' || status === 'rejected';
        case 'noted':
            return noted;
        case 'doubtful':
            return entity.slots.some(isDoubtful);
    }
}
