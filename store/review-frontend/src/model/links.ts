import type { ReviewBundle } from '../contract/generated/review-bundle';
import type { RecordIndex, SlotNode } from './record';
import { referenceTarget } from './schema';

/** A reference slot as a link goes through it: its entity, its path and the ids it holds, none while the record lacks it. */
export type LinkSlot = Pick<SlotNode, 'entity' | 'path' | 'references'>;

export type LinkDocuments = { bundle: Pick<ReviewBundle, 'entities'>; index: RecordIndex };

/** The entities a reference slot can link to, by id and name: of its target class, neither its entity nor one it holds. */
export function linkCandidates({ bundle, index }: LinkDocuments, slot: LinkSlot): { id: string; name: string }[] {
    const row = bundle.entities.find((e) => e.local_id === slot.entity);
    const target = row && referenceTarget(row, slot.path);
    if (!target) return [];
    return bundle.entities
        .filter((e) => (e.entity_class === target || e.schema_class === target) && e.local_id !== slot.entity)
        .filter((e) => !slot.references.includes(e.local_id))
        .map((e) => ({ id: e.local_id, name: index.entity(e.local_id)?.name ?? e.local_id }));
}
