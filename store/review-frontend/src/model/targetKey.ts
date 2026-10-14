import type { AnyTarget } from '../contract/generated/review-ops';

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

export const slotKey = (entity: string, path: string) => targetKey({ kind: 'slot', entity, path });
export const entityKey = (entity: string) => targetKey({ kind: 'entity', entity });
