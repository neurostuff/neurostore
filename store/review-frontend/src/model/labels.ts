import { parsePath, type Step } from './paths';
import { nameIn, type EntityNode, type RecordIndex, type SlotNode } from './record';
import { slotKey } from './targetKey';

/** The name `name` in words: underscores as spaces. */
export const inWords = (name: string) => name.replace(/_/g, ' ');

/** The name `name` in words, the first letter a capital where the name is a word. */
export const humanize = (name: string) => {
    const words = inWords(name);
    return words.length > 1 ? words[0].toUpperCase() + words.slice(1) : words;
};

/** A list's name for one of its items: `cells` → `cell`, `analyses` → `analysis`, `studies` → `study`. */
const singular = (name: string) =>
    name.endsWith('ies')
        ? `${name.slice(0, -3)}y`
        : name.endsWith('yses')
          ? `${name.slice(0, -2)}is`
          : name.endsWith('sses')
            ? name.slice(0, -2)
            : name.endsWith('s')
              ? name.slice(0, -1)
              : name;

/** The path of the steps, as record paths write them. */
const pathOf = (steps: Step[]) =>
    steps.reduce<string>(
        (path, step) => (typeof step === 'number' ? `${path}[#${step}]` : path ? `${path}.${step}` : step),
        ''
    );

/** What an entity's list items hold that names them: the reference slots of an item that name something, by the item's path. */
type ItemReferences = Map<string, SlotNode[]>;

interface ItemSlots {
    references: ItemReferences;
    /** The places of each list's items, by the list's path. */
    lists: Map<string, number[]>;
}

const itemSlotsOf = new WeakMap<EntityNode, ItemSlots>();

function itemSlots(entity: EntityNode | undefined): ItemSlots {
    if (!entity) return { references: new Map(), lists: new Map() };
    let found = itemSlotsOf.get(entity);
    if (found) return found;
    found = { references: new Map(), lists: new Map() };
    for (const slot of entity.slots) {
        for (const step of slot.path.matchAll(/\[#(\d+)\]/g)) {
            const list = slot.path.slice(0, step.index);
            const places = found.lists.get(list) ?? [];
            if (!places.includes(Number(step[1]))) found.lists.set(list, [...places, Number(step[1])]);
        }
        const item = /^(.*\[#\d+\])\./.exec(slot.path)?.[1];
        if (slot.kind !== 'reference' || !item || !slot.references.length) continue;
        found.references.set(item, [...(found.references.get(item) ?? []), slot]);
    }
    itemSlotsOf.set(entity, found);
    return found;
}

/** The name an item has of its own or from the entities it refers to through a slot other than `labelled`, if any. */
function namedBy(index: RecordIndex, entity: string, at: string, labelled: string): string | undefined {
    const own = nameIn((name) => index.slot(slotKey(entity, `${at}.${name}`))?.value?.value);
    if (own) return own;
    const referenced = itemSlots(index.entity(entity))
        .references.get(at)
        ?.find((slot) => slot.path !== labelled);
    return referenced?.references.map((id) => index.entity(id)?.name ?? id).join(', ');
}

/**
 * A list item's name: its own label or name, else the entities it refers to through a slot other than `labelled`,
 * with its place in its list where another item of the list has the same name, else its list and place in it.
 */
function itemName(index: RecordIndex, entity: string, item: Step[], labelled: string): string {
    const at = pathOf(item);
    const list = item.at(-2);
    const place = item.at(-1) as number;
    const kind = inWords(singular(typeof list === 'string' ? list : 'item'));
    const name = namedBy(index, entity, at, labelled);
    if (!name) return `${humanize(kind)} ${place + 1}`;
    const listPath = pathOf(item.slice(0, -1));
    const tail = labelled.slice(at.length);
    const shared = (itemSlots(index.entity(entity)).lists.get(listPath) ?? []).some(
        (other) =>
            other !== place &&
            namedBy(index, entity, `${listPath}[#${other}]`, `${listPath}[#${other}]${tail}`) === name
    );
    return shared ? `${name} · ${kind} ${place + 1}` : name;
}

const labelsOf = new WeakMap<RecordIndex, Map<string, string>>();

/** `slotLabel` of a slot the index holds, worked out once for each index. */
export function labelOf(index: RecordIndex, slot: { key: string; entity: string; path: string }): string {
    let labels = labelsOf.get(index);
    if (!labels) labelsOf.set(index, (labels = new Map()));
    let label = labels.get(slot.key);
    if (label === undefined) labels.set(slot.key, (label = slotLabel(index, slot)));
    return label;
}

export function slotLabel(index: RecordIndex, slot: { entity: string; path: string }): string {
    const steps = parsePath(slot.path);
    const lastItem = steps.findLastIndex((step) => typeof step === 'number');
    if (lastItem !== -1) {
        const rest = steps.slice(lastItem + 1).filter((step): step is string => typeof step === 'string');
        const item = itemName(index, slot.entity, steps.slice(0, lastItem + 1), slot.path);
        return `${item}: ${rest.map(inWords).join(' ')}`;
    }
    const names = steps as string[];
    const leaf = names.at(-1) ?? slot.path;
    return names.length > 1 ? `${humanize(names.at(-2)!)}: ${inWords(leaf)}` : humanize(leaf);
}

/** The slot as the reviewer reads it beside other entities' slots: its entity's name, then its own label. */
export const fieldLabel = (index: RecordIndex, slot: { entity: string; path: string }): string =>
    `${index.entity(slot.entity)?.name ?? slot.entity} · ${slotLabel(index, slot)}`;
