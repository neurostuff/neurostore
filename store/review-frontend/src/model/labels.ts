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

/** A class name in words, split before each capital that follows a lower-case letter; all-capital words kept, the rest lower-case. */
export const classWords = (name: string) =>
    name
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .split(' ')
        .map((word) => (/^[A-Z]+$/.test(word) ? word : word.toLowerCase()))
        .join(' ');

/** `n` and the noun, plural unless `n` is 1: `1 field`, `3 fields`. */
export const counted = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`;

/** Words with `a` or `an` before them, by their first letter. */
export const withArticle = (words: string) => `${/^[aeiou]/i.test(words) ? 'an' : 'a'} ${words}`;

/** Words listed in a sentence: `a, b and c`. */
export const listed = (words: string[]) =>
    words.length > 1 ? `${words.slice(0, -1).join(', ')} and ${words.at(-1)}` : (words[0] ?? '');

/** A list's name for one of its items: `cells` → `cell`, `analyses` → `analysis`, `studies` → `study`. */
export const singular = (name: string) =>
    name.endsWith('ies')
        ? `${name.slice(0, -3)}y`
        : name.endsWith('yses')
          ? `${name.slice(0, -2)}is`
          : name.endsWith('sses')
            ? name.slice(0, -2)
            : name.endsWith('s')
              ? name.slice(0, -1)
              : name;

/** Words for several of what `words` name: `acquisition` → `acquisitions`, `analysis` → `analyses`, `inference settings` as written. */
export const plural = (words: string) =>
    words.endsWith('sis')
        ? `${words.slice(0, -2)}es`
        : words.endsWith('s')
          ? words
          : /[^aeiou]y$/.test(words)
            ? `${words.slice(0, -1)}ies`
            : `${words}s`;

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

/**
 * The name an item of the list `list` has: of its own (a name slot, else the slot named for one of the list's items, a
 * level's `level`, else its `level`, a cell's), else from the entities it refers to through a slot other than
 * `labelled`, if any.
 */
function namedBy(index: RecordIndex, entity: string, at: string, labelled: string, list: string): string | undefined {
    const value = (name: string) => index.slot(slotKey(entity, `${at}.${name}`))?.value?.value;
    const text = (name: string) => {
        const said = value(name);
        return typeof said === 'string' && said ? said : undefined;
    };
    const own = nameIn(value) ?? text(singular(list)) ?? text('level');
    if (own) return own;
    const referenced = itemSlots(index.entity(entity))
        .references.get(at)
        ?.find((slot) => slot.path !== labelled);
    return referenced?.references.map((id) => index.entity(id)?.name ?? id).join(', ');
}

/** The last list item a slot's path goes through, as `slotItem` gives it. */
export interface SlotItem {
    /** The item's path: `levels[#1]`. */
    at: string;
    /** The list's name in the path: `levels`; `items` where the list is not named. */
    list: string;
    /** The item's place in its list, from 0. */
    place: number;
    /** The item's name, as `namedBy` gives it. */
    name?: string;
    /** The names in the path before the list: `effect` of `effect.cells[#0].term`. */
    owners: string[];
    /** The names in the path after the item: `groups` of `levels[#1].groups`. */
    leaf: string[];
}

const names = (steps: Step[]) => steps.filter((step): step is string => typeof step === 'string');

/** The last list item the path of `slot` goes through, if any. */
export function slotItem(index: RecordIndex, slot: { entity: string; path: string }): SlotItem | undefined {
    const steps = parsePath(slot.path);
    const last = steps.findLastIndex((step) => typeof step === 'number');
    if (last === -1) return undefined;
    const named = steps[last - 1];
    const list = typeof named === 'string' ? named : 'items';
    const at = pathOf(steps.slice(0, last + 1));
    return {
        at,
        list,
        place: steps[last] as number,
        name: namedBy(index, slot.entity, at, slot.path, list),
        owners: names(steps.slice(0, Math.max(last - 1, 0))),
        leaf: names(steps.slice(last + 1)),
    };
}

/**
 * A list item's name: its name as `namedBy` gives it, with its place in its list where another item of the list has
 * the same name, else its list and place in it.
 */
function itemName(index: RecordIndex, entity: string, item: SlotItem, labelled: string): string {
    const kind = inWords(singular(item.list));
    if (!item.name) return `${humanize(kind)} ${item.place + 1}`;
    const listPath = item.at.slice(0, item.at.lastIndexOf('['));
    const tail = labelled.slice(item.at.length);
    const shared = (itemSlots(index.entity(entity)).lists.get(listPath) ?? []).some(
        (other) =>
            other !== item.place &&
            namedBy(index, entity, `${listPath}[#${other}]`, `${listPath}[#${other}]${tail}`, item.list) === item.name
    );
    return shared ? `${item.name} · ${kind} ${item.place + 1}` : item.name;
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
    const item = slotItem(index, slot);
    if (item) return `${itemName(index, slot.entity, item, slot.path)}: ${item.leaf.map(inWords).join(' ')}`;
    const steps = names(parsePath(slot.path));
    const leaf = steps.at(-1) ?? slot.path;
    return steps.length > 1 ? `${humanize(steps.at(-2)!)}: ${inWords(leaf)}` : humanize(leaf);
}

/** The slot as the reviewer reads it beside other entities' slots: its entity's name, then its own label. */
export const fieldLabel = (index: RecordIndex, slot: { entity: string; path: string }): string =>
    `${index.entity(slot.entity)?.name ?? slot.entity} · ${slotLabel(index, slot)}`;
