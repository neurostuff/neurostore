import type { AnyTarget, Op, SetEvidenceOp, SetValueOp, VerdictOp } from '../contract/generated/review-ops';
import { entityPath, getIn, ROOT_ENTITY } from '../model/paths';
import type { EntityNode, RecordIndex, SlotNode } from '../model/record';
import { entityKey, relationshipKey, relationshipTarget, slotKey, slotTarget } from '../model/targetKey';
import { randomUUID } from '../model/uuid';
import type { ReviewStores } from '../store/reviewStores';
import type { SessionState } from '../store/sessionStore';
import type { Focus, Panel, PanelKind } from '../store/viewStore';
import {
    extractionSchema,
    type Schema,
    listClassesAt,
    referenceTarget,
    requiredDefaults,
    titleOf,
    wrapperSchemaAt,
} from '../model/schema';

export type RejectReason = NonNullable<VerdictOp['reason']>;

export const REJECT_REASONS: { reason: RejectReason; label: string }[] = [
    { reason: 'wrong_value', label: 'wrong value' },
    { reason: 'not_in_text', label: 'not in text' },
    { reason: 'wrong_entity', label: 'wrong entity' },
    { reason: 'duplicate', label: 'duplicate' },
    { reason: 'other', label: 'other' },
];

type Documents = Pick<SessionState, 'index' | 'bundle' | 'record'>;
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type NewOp = DistributiveOmit<Op, 'client_op_id'>;

const send = ({ session }: ReviewStores, op: NewOp) =>
    session.getState().emit({ client_op_id: randomUUID(), ...op } as Op);

/** The reference slot and target of a link's focus key on `entity`. */
function linkAt(index: RecordIndex, entity: string, key: string) {
    for (const slot of index.entity(entity)?.slots ?? []) {
        if (slot.kind !== 'reference') continue;
        const target = slot.references.find((id) => relationshipKey(slot.entity, slot.path, id) === key);
        if (target !== undefined) return { slot, target };
    }
    return undefined;
}

/** The op target of a focus key on the entity `focused`. */
export function targetOf(index: RecordIndex, focused: string, key: string): AnyTarget | undefined {
    const slot = index.slot(key);
    if (slot) return slotTarget(slot.entity, slot.path);
    if (key === entityKey(focused)) return { kind: 'entity', entity: focused };
    const link = linkAt(index, focused, key);
    return link && relationshipTarget(link.slot.entity, link.slot.path, link.target);
}

const entityRow = (s: Pick<Documents, 'bundle'>, id: string) => s.bundle.entities.find((e) => e.local_id === id);

/** The record item of an entity, as the record holds it. */
const itemOf = (s: Pick<Documents, 'record'>, id: string) => {
    const at = entityPath(s.record, id);
    return at && getIn(s.record, at);
};

/** The value wrapper schema of a slot, from the extraction record schema, choosing classes by the values held. */
export function slotSchema(s: Pick<Documents, 'bundle' | 'record'>, slot: SlotNode): Schema | undefined {
    const row = entityRow(s, slot.entity);
    if (!row) return undefined;
    const item = itemOf(s, slot.entity);
    return (
        wrapperSchemaAt(extractionSchema(), row.schema_class, slot.path, item) ??
        wrapperSchemaAt(extractionSchema(), row.entity_class, slot.path, item)
    );
}

export const acceptTarget = (stores: ReviewStores, target: AnyTarget) =>
    send(stores, { type: 'verdict', target, verdict: 'accept' });

/** Accepts the slot, entity or link of the focus key `key` on the focused entity, the focused one by default. */
export function accept(stores: ReviewStores, key?: string) {
    const { focus } = stores.view.getState();
    const target = targetOf(stores.session.getState().index, focus.entity, key ?? focus.key);
    return target ? acceptTarget(stores, target) : false;
}

/** The value slots of `entity` that have evidence and no decision yet. */
export const untouchedWithEvidence = (s: Pick<SessionState, 'index' | 'provenance'>, entity: string) =>
    (s.index.entity(entity)?.slots ?? []).filter(
        (slot) => slot.kind === 'value' && slot.value?.evidence?.status === 'present' && !s.provenance[slot.key]
    );

/** Accepts every slot on the focused card that has evidence and no decision yet; the count accepted. */
export function acceptCard(stores: ReviewStores) {
    const untouched = untouchedWithEvidence(stores.session.getState(), stores.view.getState().focus.entity);
    return untouched.filter((slot) => accept(stores, slot.key)).length;
}

export function reject(stores: ReviewStores, target: AnyTarget, reason: RejectReason, note: string) {
    return send(stores, { type: 'verdict', target, verdict: 'reject', reason, ...(note ? { note } : {}) });
}

export function addNote(stores: ReviewStores, target: AnyTarget, note: string) {
    return send(stores, { type: 'note', target, note });
}

export function setValue(stores: ReviewStores, slot: SlotNode, value: SetValueOp['value']) {
    return send(stores, { type: 'set_value', target: slotTarget(slot.entity, slot.path), value });
}

export const link = (stores: ReviewStores, slot: SlotNode, target: string) =>
    send(stores, { type: 'link', target: relationshipTarget(slot.entity, slot.path, target) });

export const unlink = (stores: ReviewStores, slot: SlotNode, target: string) =>
    send(stores, { type: 'unlink', target: relationshipTarget(slot.entity, slot.path, target) });

/** The class a reference slot links to. */
function linkClass(s: Pick<Documents, 'bundle'>, slot: SlotNode) {
    const row = entityRow(s, slot.entity);
    return row && referenceTarget(row, slot.path);
}

/** The entities a reference slot can link to: of its target class, not linked already. */
export function linkCandidates(s: Pick<Documents, 'bundle' | 'index'>, slot: SlotNode) {
    const target = linkClass(s, slot);
    if (!target) return [];
    return s.bundle.entities
        .filter(
            (e) => (e.entity_class === target || e.schema_class === target) && !slot.references.includes(e.local_id)
        )
        .filter((e) => e.local_id !== slot.entity)
        .map((e) => ({ id: e.local_id, name: s.index.entity(e.local_id)?.name ?? e.local_id }));
}

type SiblingClasses = { name: string; title: string }[];

const siblingsOf = new WeakMap<Schema, WeakMap<object, WeakMap<object, Map<string, SiblingClasses>>>>();

function siblingsCache({ bundle, record }: Pick<Documents, 'bundle' | 'record'>) {
    const schema = extractionSchema();
    let byBundle = siblingsOf.get(schema);
    if (!byBundle) siblingsOf.set(schema, (byBundle = new WeakMap()));
    let byRecord = byBundle.get(bundle);
    if (!byRecord) byBundle.set(bundle, (byRecord = new WeakMap()));
    let byEntity = byRecord.get(record);
    if (!byEntity) byRecord.set(record, (byEntity = new Map()));
    return byEntity;
}

/** The classes a new entity in the list holding `entity` can take, worked out once for each schema, bundle and record. */
export function siblingClasses(
    s: Pick<Documents, 'bundle' | 'record'>,
    entity: string
): { name: string; title: string }[] {
    const byEntity = siblingsCache(s);
    let classes = byEntity.get(entity);
    if (!classes) byEntity.set(entity, (classes = listSiblingClasses(s, entity)));
    return classes;
}

function listSiblingClasses(
    s: Pick<Documents, 'bundle' | 'record'>,
    entity: string
): { name: string; title: string }[] {
    const row = entityRow(s, entity);
    const parent = row?.parent && entityRow(s, row.parent);
    if (!row?.parent || !row.list_path || !parent) return [];
    return listClassesAt(extractionSchema(), parent.schema_class, row.list_path, itemOf(s, row.parent)).map((name) => ({
        name,
        title: titleOf(extractionSchema(), name),
    }));
}

/** Creates an entity of `className`, or of the list's only class, beside the focused entity. */
export function createSibling(stores: ReviewStores, className?: string) {
    const documents = stores.session.getState();
    const { entity } = stores.view.getState().focus;
    const row = entityRow(documents, entity);
    if (!row?.parent || !row.list_path) return false;
    const classes = siblingClasses(documents, entity);
    const chosen = className ?? (classes.length === 1 ? classes[0].name : undefined);
    if (chosen === undefined) return false;
    return send(stores, {
        type: 'create_entity',
        parent: row.parent,
        list: row.list_path,
        entity: requiredDefaults(extractionSchema(), chosen),
    });
}

export const deleteEntity = (stores: ReviewStores, entity: string) =>
    send(stores, { type: 'delete_entity', target: { kind: 'entity', entity } });

/** The entity and the ones nested in it, which a delete removes together. */
function withDescendants(s: Pick<Documents, 'bundle'>, id: string) {
    const doomed = new Set([id]);
    for (const parent of doomed) {
        for (const row of s.bundle.entities) if (row.parent === parent) doomed.add(row.local_id);
    }
    return doomed;
}

/** The links other entities have to `id` or what is nested in it, which a delete would leave dangling. */
export function danglingLinks(s: Pick<Documents, 'bundle' | 'index'>, id: string) {
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

const canDelete = (focus: Focus) => focus.entity !== ROOT_ENTITY && focus.entity !== '';

/** The panel `kind` opens on `focus`, its target resolved now; undefined where it does not apply. */
export function panelFor(s: Documents, focus: Focus, kind: PanelKind): Panel | undefined {
    const slot = focus.slot === undefined ? undefined : s.index.slot(focus.slot);
    const entity = { kind: 'entity', entity: focus.entity } as const;
    switch (kind) {
        case 'edit':
        case 'not_reported': {
            const value = s.index.slot(focus.key);
            return value?.kind === 'value'
                ? { kind, target: slotTarget(value.entity, value.path), slot: value.key }
                : undefined;
        }
        case 'reject':
        case 'note': {
            const target = targetOf(s.index, focus.entity, focus.key);
            return target ? { kind, target, slot: slot?.key } : undefined;
        }
        case 'link':
            return slot?.kind === 'reference'
                ? { kind, target: slotTarget(slot.entity, slot.path), slot: slot.key }
                : undefined;
        case 'delete':
        case 'link_analysis':
        case 'merge_entity':
            return canDelete(focus) ? { kind, target: entity } : undefined;
        case 'create':
            return siblingClasses(s, focus.entity).length > 1 ? { kind, target: entity } : undefined;
    }
}

/** C: creates an entity in the focused list, or asks which class first when the list holds several. */
export function createOn(stores: ReviewStores) {
    const view = stores.view.getState();
    const panel = panelFor(stores.session.getState(), view.focus, 'create');
    if (panel) view.openPanel(panel);
    else void createSibling(stores);
}

/** The structural ops waiting for the server, by what they touch. */
export function pendingStructure(s: Pick<SessionState, 'pending'>) {
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

/** The entities `from` can be merged into: the others of its class `index` lists. */
export const mergeCandidates = (index: RecordIndex, from: string): EntityNode[] => {
    const merged = index.entity(from);
    return index.visible.filter((e) => e.id !== from && e.entityClass === merged?.entityClass);
};

/** The value slots of `from` holding a value `into` has none for, which a merge can copy over. */
export function mergeCopies(index: RecordIndex, from: string, into: string): SlotNode[] {
    const held = new Set(index.entity(into)?.slots.flatMap((slot) => (slot.value ? [slot.path] : [])));
    return (index.entity(from)?.slots ?? []).filter(
        (slot) => slot.kind === 'value' && slot.value && !held.has(slot.path)
    );
}

/** The ops that copy a value slot, with its evidence, to the same path on `into`. */
function copyOps(slot: SlotNode, into: string): NewOp[] {
    const { extraction_status, value, value_source, unreported_reason, evidence } = slot.value!;
    const target = slotTarget(into, slot.path);
    const copied: NewOp = {
        type: 'set_value',
        target,
        value: {
            extraction_status,
            ...(value !== undefined && { value }),
            ...(value_source && { value_source }),
            ...(unreported_reason && { unreported_reason }),
        } as SetValueOp['value'],
    };
    if (!evidence?.sets?.length) return [copied];
    const sets = evidence.sets.map((set) => ({
        ...set,
        spans: set.spans.map(({ start_char, end_char }) => ({ start_char, end_char })),
    })) as NonNullable<SetEvidenceOp['evidence']['sets']>;
    return [copied, { type: 'set_evidence', target, evidence: { ...evidence, sets } }];
}

/**
 * Merges `from` into `into` as one batch: each link to `from` is re-pointed to `into`, the value slots at
 * `copy` are copied over, then `from` is deleted.
 */
export function mergeInto(stores: ReviewStores, from: string, into: string, copy: string[]) {
    const { index, emitBatch } = stores.session.getState();
    const merged = index.entity(from);
    if (!merged || !index.entity(into) || from === into) return false;
    const relinks = index.entities
        .filter((entity) => entity.id !== from)
        .flatMap((entity) =>
            entity.slots.flatMap((slot): NewOp[] => {
                if (slot.kind !== 'reference' || !slot.references.includes(from)) return [];
                const unlinked: NewOp = { type: 'unlink', target: relationshipTarget(entity.id, slot.path, from) };
                if (slot.references.includes(into) || entity.id === into) return [unlinked];
                return [unlinked, { type: 'link', target: relationshipTarget(entity.id, slot.path, into) }];
            })
        );
    const copies = merged.slots
        .filter((slot) => copy.includes(slot.path) && slot.value)
        .flatMap((slot) => copyOps(slot, into));
    const ops: NewOp[] = [...relinks, ...copies, { type: 'delete_entity', target: { kind: 'entity', entity: from } }];
    return emitBatch(ops.map((op) => ({ client_op_id: randomUUID(), ...op }) as Op));
}
