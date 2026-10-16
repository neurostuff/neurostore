import type { Op } from '../contract/generated/review-ops';
import type { StatusId } from '../inspector/status';
import { isDoubtful, type EntityNode } from '../model/record';
import { targetKey } from '../model/targetKey';

export type OutlineFilter = 'all' | 'unreviewed' | 'changed' | 'noted' | 'doubtful';

/** The target keys that carry a note: a note op, or a verdict with a note. */
export function notedKeys(ops: Op[]): Set<string> {
    return new Set(
        ops.flatMap((op) => (op.type === 'note' || (op.type === 'verdict' && op.note) ? [targetKey(op.target)] : []))
    );
}

export function outlineMatches(filter: OutlineFilter, entity: EntityNode, status: StatusId, noted: boolean): boolean {
    switch (filter) {
        case 'all':
            return true;
        case 'unreviewed':
            return status === 'unchecked';
        case 'changed':
            return status === 'edited' || status === 'added' || status === 'rejected';
        case 'noted':
            return noted;
        case 'doubtful':
            return entity.slots.some(isDoubtful);
    }
}
