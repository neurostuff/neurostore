import type { StoredOp } from '../contract/generated/review-bundle';
import type { Op } from '../contract/generated/review-ops';
import type { SessionState } from '../store/sessionStore';
import type { StatusId } from '../inspector/status';
import { isChange, type DiffStatus } from '../model/diff';
import { isDoubtful, type EntityNode } from '../model/record';
import { targetKey } from '../model/targetKey';
import type { OutlineFilter } from '../store/viewStore';

/** The notes on each target key, in op order: note ops, and verdicts given with a note. */
export function notesByKey(ops: Op[]): Map<string, string[]> {
    const notes = new Map<string, string[]>();
    for (const op of ops) {
        if ((op.type !== 'note' && op.type !== 'verdict') || !op.note) continue;
        const key = targetKey(op.target);
        notes.set(key, [...(notes.get(key) ?? []), op.note]);
    }
    return notes;
}

/** The target keys that carry a note: a note op, or a verdict with a note. */
export const notedKeys = (ops: Op[]): Set<string> => new Set(notesByKey(ops).keys());

/** The entities with a note on them, on one of their slots or on one of their links. */
export function notedEntities(ops: Op[]): Set<string> {
    return new Set(
        ops.flatMap((op) =>
            (op.type === 'note' || (op.type === 'verdict' && op.note)) && 'entity' in op.target
                ? [op.target.entity]
                : []
        )
    );
}

const notesOf = new WeakMap<StoredOp[], WeakMap<Op[], Map<string, string[]>>>();

/** The notes of the saved and pending ops by target key, worked out once for each pair of op lists. */
export function selectNotes(s: Pick<SessionState, 'ops' | 'pending'>): Map<string, string[]> {
    let byPending = notesOf.get(s.ops);
    if (!byPending) notesOf.set(s.ops, (byPending = new WeakMap()));
    let notes = byPending.get(s.pending);
    if (!notes) byPending.set(s.pending, (notes = notesByKey([...s.ops.map((stored) => stored.op), ...s.pending])));
    return notes;
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
