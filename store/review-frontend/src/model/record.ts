import type { ReviewBundle } from '../contract/generated/review-bundle';
import type { Evidence } from '../contract/generated/review-ops';
import { referenceSlotsOf } from '../contract/references';
import { fromSchema } from '../contract/schemas';
import { entityPath, getIn, isObject, parsePath, ROOT_ENTITY, type Json } from './paths';
import { slotKey } from './targetKey';

export type SpanPair = [number, number];
export type Doubt = 'not_found' | 'generated' | 'ambiguous' | 'other';

export interface ExtractedValue {
    extraction_status: 'extracted' | 'not_reported';
    value?: unknown;
    value_source?: 'reported' | 'generated';
    unreported_reason?: string;
    evidence?: Evidence;
}

export interface SlotNode {
    key: string;
    entity: string;
    path: string;
    kind: 'value' | 'reference';
    value?: ExtractedValue;
    references: string[];
    spans: SpanPair[];
    doubt: Doubt;
}

export interface EntityNode {
    id: string;
    localId: string;
    entityClass: string;
    schemaClass: string;
    /** The entity this one is nested in, if any. */
    parent: string | null;
    name: string;
    hidden: boolean;
    slots: SlotNode[];
    spans: SpanPair[];
}

export interface RecordIndex {
    entities: EntityNode[];
    /** The entities not hidden, whether or not the view shows the hidden ones. */
    unhidden: EntityNode[];
    /** The entities the view lists: all of them when `showHidden`, else the ones not hidden. */
    visible: EntityNode[];
    showHidden: boolean;
    entity(id: string): EntityNode | undefined;
    slot(key: string): SlotNode | undefined;
    allSpans: SpanPair[];
}

type EntityRow = ReviewBundle['entities'][number];

const classSlots = fromSchema(
    'extraction-record',
    (schema) => new Set(referenceSlotsOf(schema).map((r) => `${r.class}.${r.slot}`))
);
const slotNames = fromSchema('extraction-record', (schema) => new Set(referenceSlotsOf(schema).map((r) => r.slot)));
const DOUBT_RANK: Record<Doubt, number> = { not_found: 0, generated: 1, ambiguous: 2, other: 3 };
const NAME_SLOTS = ['name', 'label', 'caption', 'source_label'];
const SKIPPED = new Set(['local_id', 'extraction_metadata']);

export const isExtractedValue = (value: unknown): value is ExtractedValue =>
    isObject(value) && 'extraction_status' in value;
const isEntity = (value: unknown): value is Json => isObject(value) && typeof value.local_id === 'string';

/** The spans in reading order, each once. */
export function sortSpans(spans: SpanPair[]): SpanPair[] {
    const sorted = [...spans].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    return sorted.filter((s, i) => i === 0 || s[0] !== sorted[i - 1][0] || s[1] !== sorted[i - 1][1]);
}

function evidenceSpans(evidence: Evidence | undefined): SpanPair[] {
    return sortSpans(
        (evidence?.sets ?? []).flatMap((set) => set.spans.map((s): SpanPair => [s.start_char, s.end_char]))
    );
}

export function doubtOf(value: ExtractedValue | undefined): Doubt {
    if (!value) return 'other';
    if (value.evidence?.status === 'not_found') return 'not_found';
    if (value.value_source === 'generated') return 'generated';
    if (value.extraction_status === 'not_reported' && value.unreported_reason === 'ambiguous') return 'ambiguous';
    return 'other';
}

export const isDoubtful = (slot: SlotNode): slot is SlotNode & { doubt: Exclude<Doubt, 'other'> } =>
    slot.doubt !== 'other';

function displayName(item: Json, fallback: string): string {
    for (const slot of NAME_SLOTS) {
        const value = item[slot];
        if (isExtractedValue(value) && typeof value.value === 'string' && value.value) return value.value;
    }
    return fallback;
}

function referencesIn(value: unknown): string[] | null {
    if (typeof value === 'string') return [value];
    if (Array.isArray(value) && value.every((v) => typeof v === 'string')) return value;
    return null;
}

/** Whether `attribute` of the entity `row` is a reference slot: nested slots by name, top-level ones by class (from the x-reference annotations of the schema). */
export function isReferenceSlot(
    row: Pick<EntityRow, 'entity_class' | 'schema_class'>,
    nested: boolean,
    attribute: string
) {
    if (nested) return slotNames().has(attribute);
    const slots = classSlots();
    return slots.has(`${row.schema_class}.${attribute}`) || slots.has(`${row.entity_class}.${attribute}`);
}

function slotNode(entity: string, path: string, slot: Pick<SlotNode, 'kind' | 'value' | 'references'>): SlotNode {
    return {
        ...slot,
        key: slotKey(entity, path),
        entity,
        path,
        spans: evidenceSpans(slot.value?.evidence),
        doubt: doubtOf(slot.value),
    };
}

function slotsOf(row: EntityRow, item: Json): SlotNode[] {
    const slots: SlotNode[] = [];
    const visit = (obj: Json, prefix: string) => {
        for (const [attribute, value] of Object.entries(obj)) {
            if (SKIPPED.has(attribute)) continue;
            const path = prefix ? `${prefix}.${attribute}` : attribute;
            const targets = isReferenceSlot(row, prefix !== '', attribute) ? referencesIn(value) : null;
            if (targets) {
                slots.push(slotNode(row.local_id, path, { kind: 'reference', references: targets }));
                continue;
            }
            const children = Array.isArray(value)
                ? value.map((child, i) => [child, `${path}[#${i}]`] as const)
                : [[value, path] as const];
            for (const [child, at] of children) {
                if (isExtractedValue(child)) {
                    slots.push(slotNode(row.local_id, at, { kind: 'value', value: child, references: [] }));
                } else if (isObject(child) && !isEntity(child)) {
                    visit(child, at);
                }
            }
        }
    };
    visit(item, '');
    return slots;
}

function itemsById(record: Json): Map<string, Json> {
    const items = new Map<string, Json>([[ROOT_ENTITY, record]]);
    const visit = (value: unknown) => {
        if (Array.isArray(value)) return value.forEach(visit);
        if (!isObject(value)) return;
        if (value !== record && isEntity(value)) items.set(value.local_id as string, value);
        Object.values(value).forEach(visit);
    };
    visit(record);
    return items;
}

/** The attributes a class declares, by path; `wrapper` is set on value wrappers. */
export type Declared = (row: EntityRow) => { path: string; wrapper?: unknown }[];

/** The declared slots the record leaves out, unset: a reference that can be linked, or a value to be set. */
function absentSlots(row: EntityRow, present: SlotNode[], declared: Declared): SlotNode[] {
    const keys = new Set(present.map((slot) => slot.key));
    return declared(row).flatMap(({ path, wrapper }): SlotNode[] => {
        if (SKIPPED.has(path.split(/[.[]/)[0]) || keys.has(slotKey(row.local_id, path))) return [];
        const steps = parsePath(path);
        const attribute = steps.filter((step): step is string => typeof step === 'string').at(-1) ?? '';
        if (isReferenceSlot(row, steps.length > 1, attribute)) {
            return [slotNode(row.local_id, path, { kind: 'reference', references: [] })];
        }
        return wrapper ? [slotNode(row.local_id, path, { kind: 'value', references: [] })] : [];
    });
}

const byDoubt = (slots: SlotNode[]) => [...slots].sort((a, b) => DOUBT_RANK[a.doubt] - DOUBT_RANK[b.doubt]);
const spansOf = (slots: SlotNode[]) => sortSpans(slots.flatMap((s) => s.spans));

function indexOf(entities: EntityNode[], showHidden: boolean): RecordIndex {
    const byId = new Map(entities.map((e) => [e.id, e]));
    const bySlot = new Map(entities.flatMap((e) => e.slots.map((s) => [s.key, s] as const)));
    const unhidden = entities.filter((e) => !e.hidden);
    const visible = showHidden ? entities : unhidden;
    return {
        entities,
        unhidden,
        visible,
        showHidden,
        entity: (id) => byId.get(id),
        slot: (key) => bySlot.get(key),
        allSpans: sortSpans(visible.flatMap((e) => e.spans)),
    };
}

function replaceEntity(index: RecordIndex, entity: EntityNode): RecordIndex {
    return indexOf(
        index.entities.map((e) => (e.id === entity.id ? entity : e)),
        index.showHidden
    );
}

export function withHidden(index: RecordIndex, showHidden: boolean): RecordIndex {
    return indexOf(index.entities, showHidden);
}

export function buildRecordIndex(bundle: ReviewBundle, declared: Declared = () => [], showHidden = false): RecordIndex {
    const record = bundle.record as Json;
    const hidden = new Set([...bundle.hidden.analyses, ...bundle.hidden.entities]);
    const items = itemsById(record);
    const found = bundle.entities.flatMap((row): EntityNode[] => {
        const item = items.get(row.local_id);
        if (!item) return [];
        const present = slotsOf(row, item);
        const slots = byDoubt([...present, ...absentSlots(row, present, declared)]);
        const localId = typeof item.local_id === 'string' ? item.local_id : row.local_id;
        return [
            {
                id: row.local_id,
                localId,
                entityClass: row.entity_class,
                schemaClass: row.schema_class,
                parent: row.parent,
                name: displayName(item, row.local_id === ROOT_ENTITY ? 'Study' : localId),
                hidden: hidden.has(row.local_id),
                slots,
                spans: spansOf(slots),
            },
        ];
    });
    const classOrder = [...new Set(found.map((e) => e.entityClass))];
    return indexOf(
        classOrder.flatMap((c) => found.filter((e) => e.entityClass === c)),
        showHidden
    );
}

export function withSlotFrom(index: RecordIndex, record: Json, key: string): RecordIndex {
    const slot = index.slot(key);
    const entity = slot && index.entity(slot.entity);
    const at = slot && entityPath(record, slot.entity);
    if (!slot || !entity || !at) return index;
    const value = getIn(record, [...at, ...parsePath(slot.path)]);
    const next = slotNode(slot.entity, slot.path, {
        kind: slot.kind,
        value: isExtractedValue(value) ? value : undefined,
        references: slot.references,
    });
    const slots = entity.slots.map((s) => (s.key === key ? next : s));
    return replaceEntity(index, { ...entity, slots, spans: spansOf(slots) });
}

export function withSlotsSorted(index: RecordIndex, id: string): RecordIndex {
    const entity = index.entity(id);
    if (!entity) return index;
    const slots = byDoubt(entity.slots);
    return slots.every((s, i) => s === entity.slots[i]) ? index : replaceEntity(index, { ...entity, slots });
}

export function withSlotOrderOf(index: RecordIndex, previous: RecordIndex, id: string): RecordIndex {
    const entity = index.entity(id);
    const order = previous.entity(id)?.slots.map((s) => s.key);
    if (!entity || !order) return index;
    const rank = new Map(order.map((key, i) => [key, i]));
    const at = (key: string) => rank.get(key) ?? order.length;
    const slots = [...entity.slots].sort((a, b) => at(a.key) - at(b.key));
    return replaceEntity(index, { ...entity, slots });
}
