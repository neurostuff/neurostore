import type { ReviewBundle } from '../contract/generated/review-bundle';
import type { AnyTarget } from '../contract/generated/review-ops';
import { referenceSlotOf } from './schema';
import type { Reference } from '../contract/references';
import { fromSchema } from '../contract/schemas';
import { currentAnalyses, guidedOrder, RECORD_LINK } from './coordinates';
import { ROOT_ENTITY } from './paths';
import type { EntityNode, RecordIndex, SlotNode } from './record';
import { analysisTarget, relationshipKey, relationshipTarget, targetKey } from './targetKey';
import { linkCandidates, type LinkDocuments } from './links';
import type { ProvenanceMap } from './applyOp';
import type { StepId } from './steps';
import { labelOf } from './labels';

/** The class of the record entities that report a coordinate analysis: the one declaring its link slot. */
const analysisClass = fromSchema('extraction-record', (schema) => {
    const defs = schema.$defs as Record<string, { properties?: Record<string, unknown> }>;
    return Object.keys(defs).find((name) => RECORD_LINK in (defs[name].properties ?? {})) ?? '';
});

/** A link from the reference slot `slot` of `entity`. */
export interface Link {
    entity: EntityNode;
    slot: SlotNode;
}

export interface GuidedCards {
    /** Step 2: the Analysis entities in record order, the hidden ones last. */
    analyses: EntityNode[];
    /** Step 3: the entities the analyses reach, most reached first, then by class and name. */
    entities: EntityNode[];
    /** Step 4: the entities no analysis reaches, in record order. */
    leftovers: EntityNode[];
    /** How many analyses reach each entity of step 3. */
    reach: Map<string, number>;
    /** The links pointing at an entity, in record order. */
    linksInto(id: string): Link[];
}

const hiddenLast = (nodes: EntityNode[]) => [...nodes.filter((n) => !n.hidden), ...nodes.filter((n) => n.hidden)];

const pushTo = <T>(map: Map<string, T[]>, key: string, value: T) => map.set(key, [...(map.get(key) ?? []), value]);

/**
 * An analysis reaches the entities that link to it, and from it and every entity it reaches, the entities they
 * link to and the ones nested in them.
 */
function build(index: RecordIndex): GuidedCards {
    const analysis = analysisClass();
    const shown = new Map(index.visible.map((e) => [e.id, e]));
    const analyses = hiddenLast(index.visible.filter((e) => e.entityClass === analysis));
    const into = new Map<string, Link[]>();
    const outward = new Map<string, string[]>();
    for (const entity of index.visible) {
        for (const slot of entity.slots) {
            if (slot.kind !== 'reference') continue;
            for (const target of slot.references) {
                if (!shown.has(target)) continue;
                pushTo(into, target, { entity, slot });
                pushTo(outward, entity.id, target);
            }
        }
    }
    for (const entity of index.visible) {
        if (entity.parent && shown.has(entity.parent)) pushTo(outward, entity.parent, entity.id);
    }
    const reach = new Map<string, number>();
    for (const { id: start } of analyses) {
        const queue = [start, ...(into.get(start) ?? []).map((link) => link.entity.id)];
        const seen = new Set(queue);
        for (const id of queue) {
            for (const next of outward.get(id) ?? []) {
                if (seen.has(next)) continue;
                seen.add(next);
                queue.push(next);
            }
        }
        for (const id of seen) {
            if (shown.get(id)!.entityClass !== analysis) reach.set(id, (reach.get(id) ?? 0) + 1);
        }
    }
    const entities = [...reach.keys()]
        .map((id) => shown.get(id)!)
        .sort(
            (a, b) =>
                reach.get(b.id)! - reach.get(a.id)! ||
                a.entityClass.localeCompare(b.entityClass) ||
                a.name.localeCompare(b.name)
        );
    const leftovers = index.visible.filter(
        (e) => e.entityClass !== analysis && e.id !== ROOT_ENTITY && !reach.has(e.id)
    );
    return {
        analyses,
        entities: hiddenLast(entities),
        leftovers: hiddenLast(leftovers),
        reach,
        linksInto: (id) => into.get(id) ?? [],
    };
}

const cardsOfIndex = new WeakMap<RecordIndex, GuidedCards>();

/** The cards of the guided steps 2 to 4 over the entities the index shows. */
export function guidedCards(index: RecordIndex): GuidedCards {
    let cards = cardsOfIndex.get(index);
    if (!cards) cardsOfIndex.set(index, (cards = build(index)));
    return cards;
}

export type CardStep = 'analyses' | 'entities' | 'leftovers';

export const isCardStep = (step: StepId): step is CardStep =>
    step === 'analyses' || step === 'entities' || step === 'leftovers';

/** The cards of the step the review is on, step 5's by their analyses; null on a step without cards. */
export function stepCards(s: LinkDocuments & { step: StepId }): EntityNode[] | null {
    if (isLinkStep(s.step)) return auditCards(s).map((card) => card.analysis);
    return isCardStep(s.step) ? guidedCards(s.index)[s.step] : null;
}

/** Whether `step` is step 5, whose cards are analyses and whose rows are their links. */
export const isLinkStep = (step: StepId) => step === 'relationships';

/**
 * The reference slot an analysis's slot is, where the audit shows it: a slot of the analysis itself, held in the
 * record or not (the index gives every slot its class declares), linking to another class than its own. Two kinds of
 * link are left out as not something an analysis uses:
 * - list-item links (`groups[#].group`, `effect.cells[#].term`): the link belongs to an item with slots of its own
 *   (`n`, `direction`), and linking or unlinking cannot add or remove the item;
 * - analysis-to-analysis links (`mirror_of`): they relate analyses to each other.
 */
function auditSlot(analysis: EntityNode, slot: SlotNode): Reference | undefined {
    if (slot.kind !== 'reference' || /[.[]/.test(slot.path)) return undefined;
    const declared = referenceSlotOf(
        { entity_class: analysis.entityClass, schema_class: analysis.schemaClass },
        slot.path
    );
    return declared?.target === analysisClass() ? undefined : declared;
}

export interface AuditLink {
    /** The analysis's reference slot holding the link. */
    slot: SlotNode;
    target: string;
    /** The link's focus and provenance key. */
    key: string;
}

/** The links of an analysis to one class, and the entities of the class it could link to as well. */
export interface AuditGroup {
    className: string;
    /** The analysis's slots linking to the class, a new link going through the first. */
    slots: SlotNode[];
    links: AuditLink[];
    unlinked: { id: string; name: string }[];
    /** Whether the first slot holds a list of links, not one. */
    list: boolean;
}

/** Step 5's card of an analysis: its links by class, the classes in name order. */
export interface AuditCard {
    analysis: EntityNode;
    groups: AuditGroup[];
}

/** The groups of an analysis's card: one per class it can link to, unless the class has no entity and no link. */
function groupsOf(documents: LinkDocuments, analysis: EntityNode): AuditGroup[] {
    const byClass = new Map<string, { slots: SlotNode[]; list: boolean }>();
    for (const slot of analysis.slots) {
        const declared = auditSlot(analysis, slot);
        if (!declared) continue;
        const group = byClass.get(declared.target) ?? { slots: [], list: declared.multivalued };
        byClass.set(declared.target, { ...group, slots: [...group.slots, slot] });
    }
    return [...byClass]
        .sort(([a], [b]) => a.localeCompare(b))
        .flatMap(([className, { slots, list }]) => {
            const links = slots.flatMap((slot) =>
                slot.references.map((target) => ({
                    slot,
                    target,
                    key: relationshipKey(analysis.id, slot.path, target),
                }))
            );
            const held = slots.flatMap((slot) => slot.references);
            const unlinked = linkCandidates(documents, { ...slots[0], references: held });
            return links.length + unlinked.length > 0 ? [{ className, slots, links, unlinked, list }] : [];
        });
}

const cardsOfAudit = new WeakMap<RecordIndex, AuditCard[]>();

/** Step 5: a card per analysis that can link to another class, in the order of step 2. */
export function auditCards(documents: LinkDocuments): AuditCard[] {
    const { index } = documents;
    let cards = cardsOfAudit.get(index);
    if (!cards) {
        cards = guidedCards(index).analyses.flatMap((analysis) => {
            const groups = groupsOf(documents, analysis);
            return groups.length > 0 ? [{ analysis, groups }] : [];
        });
        cardsOfAudit.set(index, cards);
    }
    return cards;
}

/** The links of a step 5 card, group by group. */
export const cardLinks = (card: AuditCard): AuditLink[] => card.groups.flatMap((group) => group.links);

/** Step 5's link rows, card by card and group by group, as j and k move through them. */
export const auditRows = (documents: LinkDocuments): AuditLink[] => auditCards(documents).flatMap(cardLinks);

/** The relationship target of a link row. */
export const linkTarget = ({ slot, target }: AuditLink): AnyTarget =>
    relationshipTarget(slot.entity, slot.path, target);

/** Whether a group takes another link through its first slot: a list, or a single slot holding none. */
export const takesAnother = (group: AuditGroup) => group.list || group.slots[0].references.length === 0;

/** The analysis slots `entity` can be linked from, where it is not linked already and the slot takes another. */
export function analysisSlotsFor(documents: LinkDocuments, entity: EntityNode) {
    const { index } = documents;
    return auditCards(documents).flatMap(({ analysis, groups }) =>
        groups.flatMap((group) => {
            const [slot] = group.slots;
            return takesAnother(group) && group.unlinked.some((e) => e.id === entity.id)
                ? [{ id: slot.key, name: `${analysis.name} · ${labelOf(index, slot)}`, slot }]
                : [];
        })
    );
}

export interface Progress {
    done: number;
    total: number;
}

export type StepState = { index: RecordIndex; bundle: ReviewBundle };

/**
 * What a step has the reviewer judge: coordinate analyses with points, entity cards or links, none of them hidden;
 * null for submit. The view may show the hidden ones too, but the step does not ask for them.
 */
export function stepTargets(s: StepState, step: StepId): AnyTarget[] | null {
    switch (step) {
        case 'coordinates':
            return guidedOrder(currentAnalyses(s.bundle), false).map((a) => analysisTarget(a.key));
        case 'analyses':
        case 'entities':
        case 'leftovers':
            return guidedCards(s.index)[step].map((e): AnyTarget => ({ kind: 'entity', entity: e.id }));
        case 'relationships':
            return auditRows(s).map(linkTarget);
        case 'submit':
            return null;
    }
}

/** How many of a step's items are judged, the one count every view of the step shows; null for submit. */
export function stepProgress(s: StepState & { provenance: ProvenanceMap }, step: StepId): Progress | null {
    const targets = stepTargets(s, step);
    if (!targets) return null;
    return {
        done: targets.filter((target) => s.provenance[targetKey(target)] !== undefined).length,
        total: targets.length,
    };
}
