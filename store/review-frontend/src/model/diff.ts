import type { ReviewBundle } from '../contract/generated/review-bundle';
import type { AnyTarget, Evidence } from '../contract/generated/review-ops';
import type { ProvenanceMap } from './applyOp';
import type { AnalysisDiff } from './coordinateDiff';
import { currentAnalyses } from './coordinates';
import { isObject, type Json } from './paths';
import {
    type EntityNode,
    type ExtractedValue,
    type RecordIndex,
    type SlotNode,
    type SpanPair,
} from './record';
import { entityKey, relationshipKey, relationshipTarget, slotKey, slotTarget, targetKey } from './targetKey';

export type DiffStatus = 'same' | 'changed' | 'added' | 'removed' | 'rejected';

export const isChange = (status: DiffStatus) => status !== 'same';

export interface Item {
    key: string;
    status: DiffStatus;
    hidden: boolean;
    evidence: { before: SpanPair[]; after: SpanPair[] };
}

export interface EntityDiff extends Item {
    kind: 'entity';
    entity: string;
    before?: EntityNode;
    after?: EntityNode;
}

export interface SlotDiff extends Item {
    kind: 'slot';
    entity: string;
    path: string;
    before?: ExtractedValue;
    after?: ExtractedValue;
}

export interface RelationshipDiff extends Item {
    kind: 'relationship';
    entity: string;
    path: string;
    target: string;
}

export type RecordDiffItem = EntityDiff | SlotDiff | RelationshipDiff;
export type { AnalysisDiff };
export type DiffItem = RecordDiffItem | AnalysisDiff;

export interface RecordSide {
    record: Json;
    index: RecordIndex;
}

export interface ReviewDiff {
    items: DiffItem[];
    /** The items whose entity or analysis is not in the hidden set (see DESIGN.md). */
    shown: DiffItem[];
    byKey: Map<string, DiffItem>;
}

/** Whether two JSON values are equal, whatever the order of their keys. */
export function sameJson(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (Array.isArray(a) || Array.isArray(b)) {
        return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => sameJson(v, b[i]));
    }
    if (!isObject(a) || !isObject(b)) return false;
    const keys = Object.keys(a).filter((k) => a[k] !== undefined);
    return (
        keys.length === Object.keys(b).filter((k) => b[k] !== undefined).length &&
        keys.every((k) => sameJson(a[k], b[k]))
    );
}

const statusOf = (before: unknown, after: unknown, same: boolean): DiffStatus =>
    before === undefined ? 'added' : after === undefined ? 'removed' : same ? 'same' : 'changed';

const evidenceShape = (evidence: Evidence | undefined) => ({
    status: evidence?.status,
    sets: (evidence?.sets ?? []).map((set) => set.spans.map((s) => [s.start_char, s.end_char])),
});

function sameValue(before: ExtractedValue, after: ExtractedValue) {
    const { evidence: was, ...beforeValue } = before;
    const { evidence: is, ...afterValue } = after;
    return sameJson(beforeValue, afterValue) && sameJson(evidenceShape(was), evidenceShape(is));
}

function slotDiffs(entity: string, hidden: boolean, before: SlotNode[], after: SlotNode[]): SlotDiff[] {
    const was = new Map(before.filter((s) => s.kind === 'value' && s.value).map((s) => [s.key, s]));
    const is = new Map(after.filter((s) => s.kind === 'value' && s.value).map((s) => [s.key, s]));
    return [...new Set([...is.keys(), ...was.keys()])].map((key) => {
        const old = was.get(key)?.value;
        const now = is.get(key)?.value;
        return {
            kind: 'slot',
            key,
            entity,
            path: (is.get(key) ?? was.get(key))!.path,
            status: statusOf(old, now, !!old && !!now && sameValue(old, now)),
            hidden,
            before: old,
            after: now,
            evidence: { before: was.get(key)?.spans ?? [], after: is.get(key)?.spans ?? [] },
        };
    });
}

const linksOf = (slots: SlotNode[]) =>
    new Map(
        slots
            .filter((s) => s.kind === 'reference')
            .flatMap((s) =>
                s.references.map((target) => [relationshipKey(s.entity, s.path, target), { s, target }] as const)
            )
    );

function relationshipDiffs(entity: string, hidden: boolean, before: SlotNode[], after: SlotNode[]): RelationshipDiff[] {
    const was = linksOf(before);
    const is = linksOf(after);
    return [...new Set([...is.keys(), ...was.keys()])].map((key) => {
        const { s, target } = (is.get(key) ?? was.get(key))!;
        return {
            kind: 'relationship',
            key,
            entity,
            path: s.path,
            target,
            status: statusOf(was.get(key), is.get(key), true),
            hidden,
            evidence: { before: [], after: [] },
        };
    });
}

function entityDiffs(before: EntityNode | undefined, after: EntityNode | undefined): RecordDiffItem[] {
    const node = (after ?? before)!;
    const parts =
        before && after
            ? [
                  ...slotDiffs(node.id, node.hidden, before.slots, after.slots),
                  ...relationshipDiffs(node.id, node.hidden, before.slots, after.slots),
              ]
            : [];
    const entity: EntityDiff = {
        kind: 'entity',
        key: entityKey(node.id),
        entity: node.id,
        status: statusOf(
            before,
            after,
            parts.every((p) => p.status === 'same')
        ),
        hidden: node.hidden,
        before,
        after,
        evidence: { before: before?.spans ?? [], after: after?.spans ?? [] },
    };
    return [entity, ...parts];
}

function buildRecordDiff(original: RecordIndex, review: RecordIndex): RecordDiffItem[] {
    const removed = original.entities.filter((e) => !review.entity(e.id));
    return [
        ...review.entities.flatMap((after) => entityDiffs(original.entity(after.id), after)),
        ...removed.flatMap((before) => entityDiffs(before, undefined)),
    ];
}

/** The value `map` holds for `key`, built and kept on the first ask. */
export function cached<K extends object, T>(map: WeakMap<K, T>, key: K, build: () => T): T {
    let value = map.get(key);
    if (value === undefined) map.set(key, (value = build()));
    return value;
}

const recordDiffs = new WeakMap<Json, WeakMap<Json, RecordDiffItem[]>>();

/** Each entity, slot and link of the review against the original record, the review's entities first, in its order; computed once per pair of records. */
export function diffRecords(original: RecordSide, review: RecordSide): RecordDiffItem[] {
    const ofOriginal = cached(recordDiffs, original.record, () => new WeakMap());
    return cached(ofOriginal, review.record, () => buildRecordDiff(original.index, review.index));
}

const diffs = new WeakMap<RecordDiffItem[], WeakMap<AnalysisDiff[], WeakMap<ProvenanceMap, ReviewDiff>>>();

/** A record item the reviewer rejected shows as rejected while the review still holds it. */
const withRejects = (item: RecordDiffItem, provenance: ProvenanceMap): RecordDiffItem =>
    item.status !== 'removed' && provenance[item.key]?.state === 'removed' ? { ...item, status: 'rejected' } : item;

/** The record's and the coordinates' items as one diff, the reviewer's rejects marked; the same object for the same two lists and provenance. */
export function reviewDiff(
    records: RecordDiffItem[],
    coordinates: AnalysisDiff[],
    provenance: ProvenanceMap
): ReviewDiff {
    return cached(
        cached(
            cached(diffs, records, () => new WeakMap()),
            coordinates,
            () => new WeakMap()
        ),
        provenance,
        () => {
            const items: DiffItem[] = [...records.map((item) => withRejects(item, provenance)), ...coordinates];
            const byKey = new Map(items.map((item) => [item.key, item]));
            for (const item of coordinates) {
                for (const analysis of item.after) {
                    const alias = targetKey({ kind: 'coordinate_analysis', analysis_key: analysis.key });
                    if (!byKey.has(alias)) byKey.set(alias, item);
                }
            }
            return { items, shown: items.filter((item) => !item.hidden), byKey };
        }
    );
}

/** The items J and K visit and the summary lists: all of them when the non-coordinate items are shown, else those outside the hidden set (see DESIGN.md). */
export const visibleItems = (diff: ReviewDiff, showNonCoordinate: boolean): DiffItem[] =>
    showNonCoordinate ? diff.items : diff.shown;

/** The item of the coordinate analysis `key`, as it is in the review or as the original it replaced. */
export function analysisItemFor(diff: ReviewDiff, key: string): AnalysisDiff | undefined {
    const item = diff.byKey.get(targetKey({ kind: 'coordinate_analysis', analysis_key: key }));
    return item?.kind === 'analysis' ? item : undefined;
}

const landingKey = (item: DiffItem) => {
    const target = diffTarget(item);
    return target && targetKey(target);
};

/** Where `focusKey` sits among `changes`: the item of that key, else the first item that focuses it. */
function positionOf(changes: DiffItem[], focusKey: string): number {
    const own = changes.findIndex((item) => item.key === focusKey);
    return own === -1 ? changes.findIndex((item) => landingKey(item) === focusKey) : own;
}

/**
 * The first change from `focusKey` (or from the item of the focused `analysis`) in the direction `delta`
 * that `canFocus` accepts; from an item that is no change, forward finds the first change, back the last.
 */
export function nextChange(
    items: DiffItem[],
    focusKey: string,
    analysis: AnalysisDiff | undefined,
    delta: 1 | -1,
    canFocus: (item: DiffItem) => boolean
): DiffItem | undefined {
    const changes = items.filter((item) => isChange(item.status));
    const at = analysis ? changes.indexOf(analysis) : positionOf(changes, focusKey);
    const from = at === -1 && delta < 0 ? changes.length : at;
    for (let i = from + delta; i >= 0 && i < changes.length; i += delta) {
        if (canFocus(changes[i])) return changes[i];
    }
    return undefined;
}

/** The target that focuses a diff item in the review, or null when the review no longer has it. */
export function diffTarget(item: DiffItem): AnyTarget | null {
    switch (item.kind) {
        case 'entity':
            return item.status === 'removed' ? null : { kind: 'entity', entity: item.entity };
        case 'slot':
            return item.status === 'removed'
                ? { kind: 'entity', entity: item.entity }
                : slotTarget(item.entity, item.path);
        case 'relationship':
            return item.status === 'removed'
                ? slotTarget(item.entity, item.path)
                : relationshipTarget(item.entity, item.path, item.target);
        case 'analysis':
            return item.after[0] ? { kind: 'coordinate_analysis', analysis_key: item.after[0].key } : null;
    }
}

/** What focusing a target does; `key` is the focus key of a record item, or the key of the analysis. */
export type FocusIntent =
    | { kind: 'slot'; key: string }
    | { kind: 'entity'; key: string; entity: string }
    | { kind: 'link'; key: string; slot: string; target: string }
    | { kind: 'analysis'; key: string };

/** The focus a target stands for in the review, or null when the review has no such slot, entity, link or analysis. */
export function resolveTarget(
    index: RecordIndex,
    bundle: Pick<ReviewBundle, 'coordinate_parse' | 'coordinate_revision'>,
    target: AnyTarget
): FocusIntent | null {
    switch (target.kind) {
        case 'slot': {
            const key = targetKey(target);
            return index.slot(key) ? { kind: 'slot', key } : null;
        }
        case 'entity':
            return index.entity(target.entity)
                ? { kind: 'entity', key: entityKey(target.entity), entity: target.entity }
                : null;
        case 'relationship': {
            const slot = index.slot(slotKey(target.entity, target.path));
            return slot?.references.includes(target.target_entity)
                ? { kind: 'link', key: targetKey(target), slot: slot.key, target: target.target_entity }
                : null;
        }
        case 'coordinate_analysis':
            return currentAnalyses(bundle).some((a) => a.key === target.analysis_key)
                ? { kind: 'analysis', key: target.analysis_key }
                : null;
        default:
            return null;
    }
}
