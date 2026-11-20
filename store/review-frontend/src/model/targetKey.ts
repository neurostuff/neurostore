import type {
    AnyTarget,
    CoordinateParseTarget,
    CoordinateTarget,
    RelationshipTarget,
    SlotTarget,
} from '../contract/generated/review-ops';

/** A target as one string; the coordinate parse, like the paper, is `paper`, as the core keys it. */
export function targetKey(target: AnyTarget | CoordinateParseTarget): string {
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
        case 'coordinate_parse':
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

export const analysisTarget = (analysis_key: string): CoordinateTarget => ({
    kind: 'coordinate_analysis',
    analysis_key,
});

export const slotKey = (entity: string, path: string) => targetKey(slotTarget(entity, path));
export const relationshipKey = (entity: string, path: string, target_entity: string) =>
    targetKey(relationshipTarget(entity, path, target_entity));
export const entityKey = (entity: string) => targetKey({ kind: 'entity', entity });
