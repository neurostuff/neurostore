import type { AnyTarget, Op, SetValueOp, VerdictOp } from '../contract/generated/review-ops';
import { entityPath, getIn, ROOT_ENTITY } from '../model/paths';
import type { SlotNode } from '../model/record';
import { entityKey, relationshipKey, relationshipTarget, slotKey, slotTarget } from '../model/targetKey';
import { randomUUID } from '../model/uuid';
import type { Panel, PanelKind, ReviewState } from '../store/reviewStore';
import {
    EXTRACTION_SCHEMA,
    type Schema,
    listClassesAt,
    referenceTarget,
    requiredDefaults,
    titleOf,
    wrapperSchemaAt,
} from './schema';

export type RejectReason = NonNullable<VerdictOp['reason']>;

export const REJECT_REASONS: { reason: RejectReason; label: string }[] = [
    { reason: 'wrong_value', label: 'wrong value' },
    { reason: 'not_in_text', label: 'not in text' },
    { reason: 'wrong_entity', label: 'wrong entity' },
    { reason: 'duplicate', label: 'duplicate' },
    { reason: 'other', label: 'other' },
];

type State = Pick<ReviewState, 'index' | 'focus' | 'bundle' | 'record' | 'provenance' | 'pending'>;
type Emitting = State & Pick<ReviewState, 'emit'>;
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type NewOp = DistributiveOmit<Op, 'client_op_id'>;

const send = (s: Pick<ReviewState, 'emit'>, op: NewOp) => s.emit({ client_op_id: randomUUID(), ...op } as Op);

/** The reference slot and target of a link's focus key on `entity`. */
function linkAt(s: Pick<State, 'index'>, entity: string, key: string) {
    for (const slot of s.index.entity(entity)?.slots ?? []) {
        if (slot.kind !== 'reference') continue;
        const target = slot.references.find((id) => relationshipKey(slot.entity, slot.path, id) === key);
        if (target !== undefined) return { slot, target };
    }
    return undefined;
}

/** The op target of a focus key. */
function targetOf(s: Pick<State, 'index' | 'focus'>, key: string): AnyTarget | undefined {
    const slot = s.index.slot(key);
    if (slot) return slotTarget(slot.entity, slot.path);
    if (key === entityKey(s.focus.entity)) return { kind: 'entity', entity: s.focus.entity };
    const link = linkAt(s, s.focus.entity, key);
    return link && relationshipTarget(link.slot.entity, link.slot.path, link.target);
}

const focusedSlot = (s: Pick<State, 'index' | 'focus'>) => s.index.slot(s.focus.key);

const entityRow = (s: Pick<State, 'bundle'>, id: string) => s.bundle.entities.find((e) => e.local_id === id);

/** The record item of an entity, as the record holds it. */
const itemOf = (s: Pick<State, 'record'>, id: string) => {
    const at = entityPath(s.record, id);
    return at && getIn(s.record, at);
};

/** The value wrapper schema of a slot, from the extraction record schema, choosing classes by the values held. */
export function slotSchema(s: Pick<State, 'bundle' | 'record'>, slot: SlotNode): Schema | undefined {
    const row = entityRow(s, slot.entity);
    if (!row) return undefined;
    const item = itemOf(s, slot.entity);
    return (
        wrapperSchemaAt(EXTRACTION_SCHEMA, row.schema_class, slot.path, item) ??
        wrapperSchemaAt(EXTRACTION_SCHEMA, row.entity_class, slot.path, item)
    );
}

export const acceptTarget = (s: Pick<ReviewState, 'emit'>, target: AnyTarget) =>
    send(s, { type: 'verdict', target, verdict: 'accept' });

export function accept(s: Emitting, key = s.focus.key) {
    const target = targetOf(s, key);
    return target ? acceptTarget(s, target) : false;
}

/** Accepts every slot on the focused card that has evidence and no decision yet; the count accepted. */
export function acceptCard(s: Emitting) {
    const untouched = (s.index.entity(s.focus.entity)?.slots ?? []).filter(
        (slot) => slot.kind === 'value' && slot.value?.evidence?.status === 'present' && !s.provenance[slot.key]
    );
    return untouched.filter((slot) => accept(s, slot.key)).length;
}

export function reject(s: Emitting, target: AnyTarget, reason: RejectReason, note: string) {
    return send(s, { type: 'verdict', target, verdict: 'reject', reason, ...(note ? { note } : {}) });
}

export function addNote(s: Emitting, target: AnyTarget, note: string) {
    return send(s, { type: 'note', target, note });
}

export function setValue(s: Pick<ReviewState, 'emit'>, slot: SlotNode, value: SetValueOp['value']) {
    return send(s, { type: 'set_value', target: slotTarget(slot.entity, slot.path), value });
}

export const link = (s: Pick<ReviewState, 'emit'>, slot: SlotNode, target: string) =>
    send(s, { type: 'link', target: relationshipTarget(slot.entity, slot.path, target) });

export const unlink = (s: Pick<ReviewState, 'emit'>, slot: SlotNode, target: string) =>
    send(s, { type: 'unlink', target: relationshipTarget(slot.entity, slot.path, target) });

/** The class a reference slot links to. */
function linkClass(s: Pick<State, 'bundle'>, slot: SlotNode) {
    const row = entityRow(s, slot.entity);
    return row && referenceTarget(row, slot.path);
}

/** The entities a reference slot can link to: of its target class, not linked already. */
export function linkCandidates(s: Pick<State, 'bundle' | 'index'>, slot: SlotNode) {
    const target = linkClass(s, slot);
    if (!target) return [];
    return s.bundle.entities
        .filter(
            (e) => (e.entity_class === target || e.schema_class === target) && !slot.references.includes(e.local_id)
        )
        .filter((e) => e.local_id !== slot.entity)
        .map((e) => ({ id: e.local_id, name: s.index.entity(e.local_id)?.name ?? e.local_id }));
}

/** The classes a new entity in the focused entity's list can take. */
export function siblingClasses(s: Pick<State, 'bundle' | 'record' | 'focus'>): { name: string; title: string }[] {
    const row = entityRow(s, s.focus.entity);
    const parent = row?.parent && entityRow(s, row.parent);
    if (!row?.parent || !row.list_path || !parent) return [];
    return listClassesAt(EXTRACTION_SCHEMA, parent.schema_class, row.list_path, itemOf(s, row.parent)).map((name) => ({
        name,
        title: titleOf(EXTRACTION_SCHEMA, name),
    }));
}

/** Creates an entity of `className`, or of the list's only class, beside the focused entity. */
export function createSibling(s: Emitting, className?: string) {
    const row = entityRow(s, s.focus.entity);
    if (!row?.parent || !row.list_path) return false;
    const classes = siblingClasses(s);
    const chosen = className ?? (classes.length === 1 ? classes[0].name : undefined);
    if (chosen === undefined) return false;
    return send(s, {
        type: 'create_entity',
        parent: row.parent,
        list: row.list_path,
        entity: requiredDefaults(EXTRACTION_SCHEMA, chosen),
    });
}

export const deleteEntity = (s: Pick<ReviewState, 'emit'>, entity: string) =>
    send(s, { type: 'delete_entity', target: { kind: 'entity', entity } });

/** The entity and the ones nested in it, which a delete removes together. */
function withDescendants(s: Pick<State, 'bundle'>, id: string) {
    const doomed = new Set([id]);
    for (const parent of doomed) {
        for (const row of s.bundle.entities) if (row.parent === parent) doomed.add(row.local_id);
    }
    return doomed;
}

/** The links other entities have to `id` or what is nested in it, which a delete would leave dangling. */
export function danglingLinks(s: Pick<State, 'bundle' | 'index'>, id: string) {
    const doomed = withDescendants(s, id);
    return s.index.entities
        .filter((entity) => !doomed.has(entity.id))
        .flatMap((entity) =>
            entity.slots.flatMap((slot) =>
                slot.kind === 'reference'
                    ? slot.references
                          .filter((target) => doomed.has(target))
                          .map((target) => ({ entity, slot, target: s.index.entity(target)?.name ?? target }))
                    : []
            )
        );
}

const canDelete = (s: Pick<State, 'focus'>) => s.focus.entity !== ROOT_ENTITY && s.focus.entity !== '';

/** The panel `kind` opens on the focused item, its target resolved now; undefined where it does not apply. */
export function panelFor(s: Pick<State, 'index' | 'focus' | 'bundle' | 'record'>, kind: PanelKind): Panel | undefined {
    const slot = s.focus.slot === undefined ? undefined : s.index.slot(s.focus.slot);
    const entity = { kind: 'entity', entity: s.focus.entity } as const;
    switch (kind) {
        case 'edit':
        case 'not_reported': {
            const value = focusedSlot(s);
            return value?.kind === 'value'
                ? { kind, target: slotTarget(value.entity, value.path), slot: value.key }
                : undefined;
        }
        case 'reject':
        case 'note': {
            const target = targetOf(s, s.focus.key);
            return target ? { kind, target, slot: slot?.key } : undefined;
        }
        case 'link':
            return slot?.kind === 'reference'
                ? { kind, target: slotTarget(slot.entity, slot.path), slot: slot.key }
                : undefined;
        case 'delete':
            return canDelete(s) ? { kind, target: entity } : undefined;
        case 'create':
            return siblingClasses(s).length > 1 ? { kind, target: entity } : undefined;
    }
}

/** C: creates an entity in the focused list, or asks which class first when the list holds several. */
export function createOn(s: ReviewState) {
    if (siblingClasses(s).length > 1) s.openPanel('create');
    else void createSibling(s);
}

/** The structural ops waiting for the server, by what they touch. */
export function pendingStructure(s: Pick<State, 'pending'>) {
    const linksBySlot = new Map<string, Map<string, 'link' | 'unlink'>>();
    const deleting = new Set<string>();
    const creating: { parent: string; list: string }[] = [];
    for (const op of s.pending) {
        if (op.type === 'link' || op.type === 'unlink') {
            const key = slotKey(op.target.entity, op.target.path);
            const links = linksBySlot.get(key) ?? new Map<string, 'link' | 'unlink'>();
            links.set(op.target.target_entity, op.type);
            linksBySlot.set(key, links);
        } else if (op.type === 'delete_entity') deleting.add(op.target.entity);
        else if (op.type === 'create_entity') creating.push({ parent: op.parent, list: op.list });
    }
    return { linksBySlot, deleting, creating };
}
