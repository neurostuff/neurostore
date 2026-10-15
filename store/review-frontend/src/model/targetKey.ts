import type { AnyTarget, RelationshipTarget, SlotTarget } from '../contract/generated/review-ops';

export function targetKey(target: AnyTarget): string {
    switch (target.kind) {
        case 'slot':
            return `slot:${target.entity}:${target.path}`;
        case 'entity':
            return `entity:${target.entity}`;
        case 'relationship':
            return `relationship:${target.entity}:${target.path}:${target.target_entity}`;
        case 'coordinate_analysis':
            return `coordinate_analysis:${target.analysis_key}`;
        case 'paper':
            return 'paper';
    }
}

export const slotTarget = (entity: string, path: string): SlotTarget => ({ kind: 'slot', entity, path });
export const relationshipTarget = (entity: string, path: string, target_entity: string): RelationshipTarget => ({
    kind: 'relationship',
    entity,
    path,
    target_entity,
});

export const slotKey = (entity: string, path: string) => targetKey(slotTarget(entity, path));
export const relationshipKey = (entity: string, path: string, target_entity: string) =>
    targetKey(relationshipTarget(entity, path, target_entity));
export const entityKey = (entity: string) => targetKey({ kind: 'entity', entity });
