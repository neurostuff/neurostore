import type { AnyTarget, Op, SetEvidenceOp, SetValueOp, VerdictOp } from '../contract/generated/review-ops';
import { classWords, counted, listed, withArticle } from '../model/labels';
import { entityPath, getIn, ROOT_ENTITY, writePath, type Json } from '../model/paths';
import type { EntityNode, RecordIndex, SlotNode } from '../model/record';
import { statusOf } from './status';
import { entityKey, relationshipKey, relationshipTarget, slotKey, slotTarget } from '../model/targetKey';
import { auditCards, cardLinks, isLinkStep, linkTarget, type AuditCard } from '../model/guided';
import { selectShown } from '../store/viewSelectors';
import { randomUUID } from '../model/uuid';
import type { ReviewStores } from '../store/reviewStores';
import type { SessionState } from '../store/sessionStore';
import type { AcceptedCard, Focus, Panel, PanelKind } from '../store/viewStore';
import {
    extractionSchema,
    type Schema,
    listClassesAt,
    type OpenReference,
    skeletonOf,
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

/** The value fields of `entity` with a value and no decision yet: those whose evidence is present, and the rest. */
export function unjudgedFields(s: Pick<SessionState, 'index' | 'provenance'>, entity: string) {
    const withEvidence: SlotNode[] = [];
    const withoutEvidence: SlotNode[] = [];
    for (const slot of s.index.entity(entity)?.slots ?? []) {
        if (slot.kind !== 'value' || !slot.value || s.provenance[slot.key]) continue;
        (statusOf(slot) === 'present' ? withEvidence : withoutEvidence).push(slot);
    }
    return { withEvidence, withoutEvidence };
}

/** Which unjudged fields a card accept takes: those with evidence, or all of them. */
export type CardFields = 'evidence' | 'all';

/** An accept of each target, as the ops of one batch. */
const acceptOps = (targets: AnyTarget[]) =>
    targets.map((target): Op => ({ client_op_id: randomUUID(), type: 'verdict', target, verdict: 'accept' }));

/**
 * Accepts the unjudged fields of `entity` with evidence, or all of them, and the entity while it is unchecked, as
 * one batch; what it accepted, or undefined where there was nothing to send.
 */
export function acceptCard(stores: ReviewStores, entity: string, fields: CardFields): AcceptedCard | undefined {
    const session = stores.session.getState();
    const { withEvidence, withoutEvidence } = unjudgedFields(session, entity);
    const slots = fields === 'all' ? [...withEvidence, ...withoutEvidence] : withEvidence;
    const unchecked = !session.provenance[entityKey(entity)];
    const targets: AnyTarget[] = slots.map((slot) => slotTarget(slot.entity, slot.path));
    if (unchecked) targets.push({ kind: 'entity', entity });
    if (!session.emitBatch(acceptOps(targets))) return undefined;
    const accepted = {
        card: entity,
        entity: unchecked,
        fields: slots.length,
        links: 0,
        withoutEvidenceLeft: fields === 'all' ? 0 : withoutEvidence.length,
    };
    stores.view.getState().showAccepted(accepted);
    return accepted;
}

/** What a card accept says it did: `Accepted the analysis and 6 fields · 2 fields without evidence still unchecked`. */
export function acceptedText({ entity, fields, links, withoutEvidenceLeft: left }: AcceptedCard, kind: string) {
    const taken = [
        ...(entity ? [`the ${kind}`] : []),
        ...(fields > 0 ? [counted(fields, 'field')] : []),
        ...(links > 0 ? [counted(links, 'link')] : []),
    ];
    const done = `Accepted ${listed(taken)}`;
    return left > 0 ? `${done} · ${counted(left, 'field')} without evidence still unchecked` : done;
}

/** Accepts the focused card at once, or first asks which fields to take where some unjudged ones have no evidence. */
export function acceptOrAsk(stores: ReviewStores) {
    const session = stores.session.getState();
    const view = stores.view.getState();
    const { entity } = view.focus;
    if (!session.index.entity(entity)) return;
    if (unjudgedFields(session, entity).withoutEvidence.length > 0)
        view.openPanel({ kind: 'accept_card', target: { kind: 'entity', entity } });
    else acceptCard(stores, entity, 'evidence');
}

/** The links of a step 5 card no one has judged yet. */
export const unjudgedLinks = (s: Pick<SessionState, 'provenance'>, card: AuditCard) =>
    cardLinks(card).filter((link) => !s.provenance[link.key]);

/** How many of a step 5 card's links are judged, of how many: the count the step's own adds up. */
export function linkProgress(s: Pick<SessionState, 'provenance'>, card: AuditCard) {
    const total = cardLinks(card).length;
    return { done: total - unjudgedLinks(s, card).length, total };
}

/** Accepts a step 5 card's unjudged links as one batch; how many, or undefined where there were none. */
export function acceptLinks(stores: ReviewStores, card: AuditCard): AcceptedCard | undefined {
    const session = stores.session.getState();
    const targets = unjudgedLinks(session, card).map(linkTarget);
    if (targets.length === 0 || !session.emitBatch(acceptOps(targets))) return undefined;
    const accepted = {
        card: card.analysis.id,
        entity: false,
        fields: 0,
        links: targets.length,
        withoutEvidenceLeft: 0,
    };
    stores.view.getState().showAccepted(accepted);
    return accepted;
}

/** The step 5 card of the analysis `analysis`, as the view lists the cards. */
export function cardOf(stores: ReviewStores, analysis: string) {
    const session = stores.session.getState();
    const index = selectShown(session, stores.view.getState());
    return auditCards({ index, bundle: session.bundle }).find((card) => card.analysis.id === analysis);
}

/** Shift+A: on step 5 the focused card's unjudged links, elsewhere the focused card as acceptOrAsk takes it. */
export function acceptFocusedCard(stores: ReviewStores) {
    const { step, focus } = stores.view.getState();
    if (!isLinkStep(step)) return acceptOrAsk(stores);
    const card = cardOf(stores, focus.entity);
    if (card) acceptLinks(stores, card);
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

/** A reference slot as a link or unlink names it, held in the record or not. */
type LinkingSlot = Pick<SlotNode, 'entity' | 'path'>;

export const link = (stores: ReviewStores, slot: LinkingSlot, target: string) =>
    send(stores, { type: 'link', target: relationshipTarget(slot.entity, slot.path, target) });

export const unlink = (stores: ReviewStores, slot: LinkingSlot, target: string) =>
    send(stores, { type: 'unlink', target: relationshipTarget(slot.entity, slot.path, target) });

/** Changes the single link of `slot` from `from` to `to`, as one batch: an unlink, then a link. */
export function changeLink(stores: ReviewStores, slot: LinkingSlot, from: string, to: string) {
    const ops: Op[] = [
        { client_op_id: randomUUID(), type: 'unlink', target: relationshipTarget(slot.entity, slot.path, from) },
        { client_op_id: randomUUID(), type: 'link', target: relationshipTarget(slot.entity, slot.path, to) },
    ];
    return stores.session.getState().emitBatch(ops);
}

export { linkCandidates } from '../model/links';

/** The entities of class `target`, by id and name. */
const entitiesOf = (s: Pick<Documents, 'bundle' | 'index'>, target: string) =>
    s.bundle.entities
        .filter((e) => e.entity_class === target || e.schema_class === target)
        .map((e) => ({ id: e.local_id, name: s.index.entity(e.local_id)?.name ?? e.local_id }));

type SiblingClasses = { name: string; title: string }[];

type ByDocuments<T> = WeakMap<Schema, WeakMap<object, WeakMap<object, Map<string, T>>>>;

const siblingsOf: ByDocuments<SiblingClasses> = new WeakMap();

/** The values `caches` holds by entity for the schema, bundle and record now. */
function documentsCache<T>(caches: ByDocuments<T>, { bundle, record }: Pick<Documents, 'bundle' | 'record'>) {
    const schema = extractionSchema();
    let byBundle = caches.get(schema);
    if (!byBundle) caches.set(schema, (byBundle = new WeakMap()));
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
    const byEntity = documentsCache(siblingsOf, s);
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

export type NewEntity =
    | { entity: Json }
    | { pick: OpenReference & { candidates: { id: string; name: string }[] } }
    | { unavailable: string };

/**
 * The entity of `className` to create beside `entity`: its skeleton, each required reference the sibling does not
 * fill set to the one in `picked`, else to the only entity of its class; the reference to pick first where there
 * are several, or why it cannot be made where there are none.
 */
export function newEntity(
    s: Documents,
    entity: string,
    className: string,
    picked: Record<string, string> = {}
): NewEntity {
    const skeleton = skeletonOf(extractionSchema(), className, itemOf(s, entity));
    let made = skeleton.entity;
    for (const open of skeleton.open) {
        const candidates = entitiesOf(s, open.target);
        const chosen = picked[open.path] ?? (candidates.length === 1 ? candidates[0].id : undefined);
        if (chosen !== undefined) made = writePath(made, open.path, chosen);
        else if (candidates.length === 0)
            return {
                unavailable: `Add ${withArticle(classWords(open.target))} first: ${withArticle(classWords(className))} needs one`,
            };
        else return { pick: { ...open, candidates } };
    }
    return { entity: made };
}

/** Sends `made`'s entity as a create_entity beside the focused entity; false where it is not whole or the focus is in no list. */
export function createNew(stores: ReviewStores, made: NewEntity) {
    const row = entityRow(stores.session.getState(), stores.view.getState().focus.entity);
    if (!row?.parent || !row.list_path || !('entity' in made)) return false;
    return send(stores, { type: 'create_entity', parent: row.parent, list: row.list_path, entity: made.entity });
}

/** Creates an entity of `className`, or of the list's only class, beside the focused entity, once it can be made whole. */
export function createSibling(stores: ReviewStores, className?: string) {
    const documents = stores.session.getState();
    const { entity } = stores.view.getState().focus;
    const classes = siblingClasses(documents, entity);
    const chosen = className ?? (classes.length === 1 ? classes[0].name : undefined);
    return chosen !== undefined && createNew(stores, newEntity(documents, entity, chosen));
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
            return siblingClasses(s, focus.entity).length > 1 || creatable(s, focus.entity).asks
                ? { kind, target: entity }
                : undefined;
    }
}

/**
 * Why an entity of `className` cannot be made beside `entity`, when it cannot. A fast path: a class whose skeleton
 * leaves no reference open is always made, so the sibling is not read for it.
 */
export function cannotMake(s: Documents, entity: string, className: string): string | undefined {
    if (skeletonOf(extractionSchema(), className).open.length === 0) return undefined;
    const made = newEntity(s, entity, className);
    return 'unavailable' in made ? made.unavailable : undefined;
}

interface Creatable {
    /** Why no class the list holds can be made, when none can. */
    reason?: string;
    /** Whether the list's only class asks which entity a reference takes first. */
    asks: boolean;
}

const creatableBeside: ByDocuments<Creatable> = new WeakMap();

/** Whether and how an entity can be created beside `entity`, worked out once for each schema, bundle and record. */
function creatable(s: Documents, entity: string): Creatable {
    const byEntity = documentsCache(creatableBeside, s);
    if (!byEntity.has(entity)) byEntity.set(entity, creatableFrom(s, entity));
    return byEntity.get(entity)!;
}

function creatableFrom(s: Documents, entity: string): Creatable {
    const classes = siblingClasses(s, entity);
    if (classes.length === 0)
        return { reason: 'Focus an entity in a list first, to add another beside it', asks: false };
    const reasons = classes.map(({ name }) => cannotMake(s, entity, name));
    const only = classes.length === 1 && reasons[0] === undefined ? classes[0].name : undefined;
    return {
        reason: reasons.every((reason) => reason !== undefined) ? reasons[0] : undefined,
        asks:
            only !== undefined &&
            skeletonOf(extractionSchema(), only).open.length > 0 &&
            'pick' in newEntity(s, entity, only),
    };
}

/** Why no entity can be created beside `entity`: why the first class the list holds cannot be made, when none can. */
export const cannotCreate = (s: Documents, entity: string) => creatable(s, entity).reason;

/** C: creates an entity in the focused list, or asks which class, or which entity a reference takes, first. */
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

/** The links to and from the reference slot `slot` waiting for the server: the ids being linked, and being unlinked. */
export function pendingLinks(s: Pick<SessionState, 'pending'>, slot: string) {
    const ops = pendingStructure(s).linksBySlot.get(slot);
    const of = (type: 'link' | 'unlink') => [...(ops ?? [])].flatMap(([id, t]) => (t === type ? [id] : []));
    return { linking: of('link'), unlinking: new Set(of('unlink')) };
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
