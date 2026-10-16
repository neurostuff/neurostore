import type { ReviewBundle } from '../contract/generated/review-bundle';
import type { AnyTarget } from '../contract/generated/review-ops';
import { analysisTarget } from '../coordinates/actions';
import { referenceTarget } from '../inspector/schema';
import { fromSchema } from '../contract/schemas';
import { currentAnalyses, guidedOrder, RECORD_LINK } from '../model/coordinates';
import { ROOT_ENTITY } from '../model/paths';
import type { EntityNode, RecordIndex, SlotNode } from '../model/record';
import { relationshipTarget, targetKey } from '../model/targetKey';
import type { ProvenanceMap } from '../model/applyOp';
import type { StepId } from './steps';

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

/** The cards of the step the review is on, or null on a step without entity cards. */
export function stepCards(s: { index: RecordIndex; step: StepId }): EntityNode[] | null {
    return isCardStep(s.step) ? guidedCards(s.index)[s.step] : null;
}

export interface AuditGroup {
    className: string;
    columns: EntityNode[];
}

export interface AuditCell {
    /** The analysis's reference slot that links the entity, if one does. */
    holding?: SlotNode;
    /** The slot a click links or unlinks through; none when the analysis has no slot for the class. */
    slot?: SlotNode;
}

export interface AuditMatrix {
    rows: EntityNode[];
    groups: AuditGroup[];
    cell(analysis: EntityNode, className: string, entity: EntityNode): AuditCell;
}

const ofClass = (entity: EntityNode, className: string) =>
    entity.entityClass === className || entity.schemaClass === className;

/** The analyses' reference slots by the class they link to. */
function slotsByClass(analysis: EntityNode) {
    const row = { entity_class: analysis.entityClass, schema_class: analysis.schemaClass };
    const byClass = new Map<string, SlotNode[]>();
    for (const slot of analysis.slots) {
        const target = slot.kind === 'reference' ? referenceTarget(row, slot.path) : undefined;
        if (target) pushTo(byClass, target, slot);
    }
    return byClass;
}

function buildMatrix(index: RecordIndex, analyses: EntityNode[]): AuditMatrix {
    const slots = new Map(analyses.map((a) => [a.id, slotsByClass(a)]));
    const classes = [...new Set([...slots.values()].flatMap((byClass) => [...byClass.keys()]))].sort();
    const groups = classes
        .map((className) => ({ className, columns: index.visible.filter((e) => ofClass(e, className)) }))
        .filter((group) => group.columns.length > 0);
    return {
        rows: analyses,
        groups,
        cell: (analysis, className, entity) => {
            const candidates = slots.get(analysis.id)?.get(className) ?? [];
            const holding = candidates.find((slot) => slot.references.includes(entity.id));
            const slot = holding ?? (entity.id === analysis.id ? undefined : candidates[0]);
            return { holding, slot };
        },
    };
}

const matrixOfIndex = new WeakMap<RecordIndex, AuditMatrix>();

/** Step 5: the analyses against every entity of each class they can link to. */
export function auditMatrix(index: RecordIndex): AuditMatrix {
    let matrix = matrixOfIndex.get(index);
    if (!matrix) matrixOfIndex.set(index, (matrix = buildMatrix(index, guidedCards(index).analyses)));
    return matrix;
}

/** The analysis slots `entity` can be linked from, where it is not linked already. */
export function analysisSlotsFor(index: RecordIndex, entity: EntityNode) {
    const matrix = auditMatrix(index);
    const classes = matrix.groups.filter((g) => g.columns.includes(entity)).map((g) => g.className);
    return matrix.rows.flatMap((analysis) =>
        classes.flatMap((className) => {
            const { holding, slot } = matrix.cell(analysis, className, entity);
            return slot && !holding ? [{ id: slot.key, name: `${analysis.name} · ${slot.path}`, slot }] : [];
        })
    );
}

export interface Progress {
    done: number;
    total: number;
}

export type StepState = { index: RecordIndex; bundle: ReviewBundle; showNonCoordinate: boolean };

/** What a step has the reviewer judge: coordinate analyses, entity cards or links; null for submit. */
export function stepTargets(s: StepState, step: StepId): AnyTarget[] | null {
    switch (step) {
        case 'coordinates':
            return guidedOrder(currentAnalyses(s.bundle), s.showNonCoordinate).map((a) => analysisTarget(a.key));
        case 'analyses':
        case 'entities':
        case 'leftovers':
            return guidedCards(s.index)[step].map((e): AnyTarget => ({ kind: 'entity', entity: e.id }));
        case 'relationships':
            return auditMatrix(s.index).rows.flatMap((analysis) =>
                analysis.slots.flatMap((slot) =>
                    slot.kind === 'reference'
                        ? slot.references.map((target) => relationshipTarget(analysis.id, slot.path, target))
                        : []
                )
            );
        case 'submit':
            return null;
    }
}

/** How many of a step's items are judged; null for submit. */
export function stepProgress(s: StepState & { provenance: ProvenanceMap }, step: StepId): Progress | null {
    const targets = stepTargets(s, step);
    if (!targets) return null;
    return {
        done: targets.filter((target) => s.provenance[targetKey(target)] !== undefined).length,
        total: targets.length,
    };
}
