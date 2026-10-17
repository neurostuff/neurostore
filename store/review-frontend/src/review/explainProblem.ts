import { entityPath, type Json, type Step } from '../model/paths';
import type { EntityNode, RecordIndex } from '../model/record';
import { slotKey } from '../model/targetKey';

export interface Explained {
    message: string;
    /** The entity card's title and the slot's label, in the reviewer's terms. */
    label?: string;
    focus?: { entity: string; slot?: string };
}

const SCHEMA_PATH = /^\S+ (\/\S*?):?(?=\s|$)\s*/;

const toStep = (part: string): Step => (/^\d+$/.test(part) ? Number(part) : part);

/** The deepest entity whose record path leads `steps`, with that path's length. */
function ownerOf(index: RecordIndex, record: Json, steps: Step[]) {
    let owner: { entity: EntityNode; depth: number } | undefined;
    for (const entity of index.entities) {
        const at = entityPath(record, entity.id);
        if (!at || at.length > steps.length || at.some((step, i) => step !== steps[i])) continue;
        if (!owner || at.length > owner.depth) owner = { entity, depth: at.length };
    }
    return owner;
}

/** A refusal's message with its schema path (`extraction-record /a/0/b: ...`) put in the reviewer's terms. */
export function explain(problem: string, index: RecordIndex, record: Json): Explained {
    const match = SCHEMA_PATH.exec(problem);
    if (!match) return { message: problem };
    const message = problem.slice(match[0].length);
    const steps = match[1].slice(1).split('/').map(toStep);
    const owner = ownerOf(index, record, steps);
    if (!owner) return { message };
    const { entity, depth } = owner;
    const names = steps.slice(depth).filter((step): step is string => typeof step === 'string');
    for (let n = names.length; n > 0; n--) {
        const slot = index.slot(slotKey(entity.id, names.slice(0, n).join('.')));
        if (slot)
            return { message, label: `${entity.name} · ${slot.path}`, focus: { entity: entity.id, slot: slot.key } };
    }
    return { message, label: entity.name, focus: { entity: entity.id } };
}
