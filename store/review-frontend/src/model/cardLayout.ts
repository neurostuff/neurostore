import {
    CARD_TEMPLATES,
    templatePaths,
    type CardTemplate,
    type Phrase,
    type Range,
    type SlotPhrase,
} from './cardTemplates';
import { comparesTerms, comparisonSlots, isCellSlot } from './comparison';
import { cached } from './diff';
import { humanize, inWords, singular } from './labels';
import { leafOf, listOf } from './paths';
import { NAME_SLOTS, type EntityNode, type RecordIndex, type SlotNode } from './record';
import { lineWords, valueWords } from './valueText';

export type Piece =
    | { kind: 'text'; text: string }
    | { kind: 'value'; slot: SlotNode; text: string }
    /** A distribution item whose count and percentage disagree with its denominator. */
    | { kind: 'warn'; item: string; text: string };

export interface Row {
    label: string;
    /** The slot or list the row says. */
    path: string;
    pieces: Piece[];
}

export type Chip =
    | { kind: 'link'; slot: SlotNode; target: string; name: string }
    | { kind: 'none'; slot: SlotNode }
    /** A list item, its own fields inside the chip. */
    | { kind: 'item'; item: string; pieces: Piece[] }
    | { kind: 'entity'; entity: EntityNode };

export interface LinkGroup {
    label: string;
    /** The slot or list the group says; none for a group of child entities the schema holds nowhere. */
    path?: string;
    chips: Chip[];
}

/**
 * A list item the slots of a list belong to: its path, its name, its fields by name, the fields folded away in its
 * details, and those only its details show.
 */
export interface ItemOf {
    at: string;
    name: string;
    fields: Map<string, SlotNode>;
    distribution: boolean;
    folded: SlotNode[];
    detailsOnly: SlotNode[];
}

/**
 * Where a slot is placed: the card's title, the comparison, a sentence, a row, a link, the fold, or the details of
 * its list item only.
 */
export type Where = 'title' | 'comparison' | 'about' | 'row' | 'link' | 'fold' | 'item';

export interface Placement {
    where: Where;
    /** The section or link group the slot is shown under. */
    section: string;
    item?: ItemOf;
    /** Whether the generic rules placed it, its class's template not naming it. */
    leftover?: boolean;
}

export interface CardLayout {
    /** The slot the card's title is: its name. */
    title?: SlotNode;
    /** Its sentences, then its short fields said as "label value". */
    about: Piece[][];
    rows: Row[];
    links: LinkGroup[];
    /** The fields folded away: absent, or not reported and not ambiguous. */
    folded: SlotNode[];
    /** The slots j and k walk, in the order shown, the fold left out. */
    order: SlotNode[];
    /** Where each slot of the entity is placed, by its key. */
    places: Map<string, Placement>;
    /** The slots the template names more than once, each placed at its first. */
    doubled: string[];
}

/**
 * Whether a slot folds away: it is not in the record, or not reported, the extractor finding nothing unclear; or it is
 * an empty link of a nested part, such as an effect's mediation.
 */
export const isFolded = (slot: SlotNode) =>
    slot.kind === 'value'
        ? !slot.value || (slot.value.extraction_status === 'not_reported' && slot.doubt !== 'ambiguous')
        : slot.references.length === 0 && slot.path.includes('.');

const text = (words: string): Piece => ({ kind: 'text', text: words });

interface Said {
    pieces: Piece[];
    shows: boolean;
}

const NOTHING: Said = { pieces: [], shows: false };

const DISTRIBUTION_FIELDS = new Set([
    'category',
    'count',
    'percentage',
    'denominator',
    'reporting_framework',
    'category_normalized',
]);

/** The value a slot holds, where it is extracted. */
const valueOf = (slot: SlotNode | undefined) =>
    slot?.value?.extraction_status === 'extracted' ? slot.value.value : undefined;

const numberIn = (slot: SlotNode | undefined) => {
    const value = valueOf(slot);
    return typeof value === 'number' ? value : undefined;
};

export interface DistributionCheck {
    matches: boolean;
    text: string;
}

/**
 * Whether a distribution item's count and percentage agree with its denominator, to the places the percentage is
 * given to; undefined where it lacks one of the three.
 */
export function checkDistribution(fields: Map<string, SlotNode>): DistributionCheck | undefined {
    const [count, percentage, denominator] = ['count', 'percentage', 'denominator'].map((f) => numberIn(fields.get(f)));
    if (count === undefined || percentage === undefined || !denominator) return undefined;
    const places = String(percentage).split('.')[1]?.length ?? 0;
    const expected = (count / denominator) * 100;
    const matches = Math.abs(expected - percentage) <= Math.max(0.05, 0.5 * 10 ** -places) + 1e-9;
    const said = `${count} of ${denominator} is ${expected.toFixed(Math.max(places, 1))}%`;
    return { matches, text: matches ? `${said}: matches` : `${said}: doesn’t match ${percentage}%` };
}

/** Whether a slot holds a value to say. */
const isSaid = (slot: SlotNode | undefined): slot is SlotNode => valueOf(slot) !== undefined;
const sameWords = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** The slot the card's title is: the first name slot holding a name, else the first name slot it has. */
function titleSlot(entity: EntityNode): SlotNode | undefined {
    const named = NAME_SLOTS.flatMap((name) => entity.slots.find((s) => s.path === name) ?? []);
    return named.find((slot) => typeof valueOf(slot) === 'string' && valueOf(slot) !== '') ?? named[0];
}

/** Whether a template places the slot: it names its path or its list. */
function claimedBy(paths: Set<string>, slot: SlotNode) {
    return paths.has(slot.path) || (listOf(slot.path) !== undefined && paths.has(listOf(slot.path)!.list));
}

class Builder {
    readonly places = new Map<string, Placement>();
    readonly folded: SlotNode[] = [];
    readonly order: SlotNode[] = [];
    readonly doubled: string[] = [];
    private readonly bySlot: Map<string, SlotNode>;
    private readonly lists = new Map<string, Map<string, SlotNode[]>>();

    constructor(
        readonly index: RecordIndex,
        readonly entity: EntityNode
    ) {
        this.bySlot = new Map(entity.slots.map((s) => [s.path, s]));
        for (const slot of entity.slots) {
            const at = listOf(slot.path);
            if (!at) continue;
            const items = this.lists.get(at.list) ?? new Map<string, SlotNode[]>();
            items.set(at.item, [...(items.get(at.item) ?? []), slot]);
            this.lists.set(at.list, items);
        }
    }

    /** Whether the slot is placed already; a second placement a template asks for is noted as doubled. */
    has(key: string, leftover?: boolean) {
        const placed = this.places.get(key);
        if (placed && !leftover && placed.where !== 'title') this.doubled.push(key);
        return placed !== undefined;
    }

    slotAt = (path: string) => this.bySlot.get(path);

    place(slot: SlotNode, where: Where, section: string, item?: ItemOf, leftover?: boolean) {
        const folds = isFolded(slot) && !item && where !== 'title';
        const placement: Placement = { where: folds ? 'fold' : where, section, item };
        if (leftover) placement.leftover = true;
        this.places.set(slot.key, placement);
        if (placement.where === 'fold') this.folded.push(slot);
    }

    value(slot: SlotNode, words: string): Piece {
        this.order.push(slot);
        return { kind: 'value', slot, text: words };
    }

    /** An item's name: the entities it links to, its category or name, else its list's word and place. */
    private nameOf(list: string, place: number, fields: Map<string, SlotNode>): string {
        const linked = [...fields.values()].find((s) => s.kind === 'reference' && s.references.length);
        if (linked) return valueWords(this.index, linked);
        const own = ['category', 'name', 'label', 'level', 'qualifier'].map((f) => valueOf(fields.get(f)));
        const named = own.find((v) => typeof v === 'string' && v);
        return typeof named === 'string' ? named : `${humanize(singular(inWords(leafOf(list))))} ${place + 1}`;
    }

    /** The pieces of each item of the list at `path`, its slots placed; undefined where the entity has no such list. */
    list(path: string, where: Where, section: string, label: string, leftover?: boolean): Piece[][] | undefined {
        const items = this.lists.get(path);
        if (!items || [...items.values()].some((slots) => slots.some((s) => this.has(s.key, leftover))))
            return undefined;
        const distribution = [...items].every(
            ([at, slots]) =>
                slots.some((s) => s.path === `${at}.category`) &&
                slots.every((s) => DISTRIBUTION_FIELDS.has(s.path.slice(at.length + 1)))
        );
        const entries = [...items].map(([at, slots], place): ItemOf => {
            const fields = new Map(slots.map((s) => [s.path.slice(at.length + 1), s]));
            return { at, name: this.nameOf(path, place, fields), fields, distribution, folded: [], detailsOnly: [] };
        });
        if (distribution) return [this.distribution(entries, where, section, label, leftover)];
        return entries.map((item) => {
            for (const slot of item.fields.values()) this.place(slot, where, section, item, leftover);
            return this.item(item);
        });
    }

    private item(item: ItemOf): Piece[] {
        const pieces: Piece[] = [];
        [...item.fields].forEach(([field, slot], i) => {
            if (i > 0) pieces.push(text(' · '));
            if (i > 0 && slot.kind === 'value') pieces.push(text(`${inWords(leafOf(field))} `));
            pieces.push(this.value(slot, valueWords(this.index, slot)));
        });
        return pieces;
    }

    /**
     * A distribution on one line: each item's category, count and percentage, the denominator and framework said
     * once where the items share them, and a framework that is the list's own name left to the details. A field not
     * reported folds away; the rest of an item's fields its details show, and j and k reach them after its line.
     */
    private distribution(items: ItemOf[], where: Where, section: string, label: string, leftover?: boolean): Piece[] {
        const words = (item: ItemOf, field: string) => {
            const slot = item.fields.get(field);
            return isSaid(slot) ? valueWords(this.index, slot) : undefined;
        };
        const shared = (field: string) => items.every((item) => words(item, field) === words(items[0], field));
        const sharedDenominator =
            items.length > 1 && words(items[0], 'denominator') !== undefined && shared('denominator');
        const framework = words(items[0], 'reporting_framework');
        const sharedFramework = framework !== undefined && shared('reporting_framework');
        const frameworkSaid = sharedFramework && !sameWords(framework, label);
        const pieces: Piece[] = [];
        const shown = new Set<string>();
        const say = (item: ItemOf, field: string, before = '', after = '') => {
            const slot = item.fields.get(field);
            if (!slot || (field !== 'category' && !isSaid(slot))) return;
            if (before) pieces.push(text(before));
            pieces.push(this.value(slot, valueWords(this.index, slot)));
            if (after) pieces.push(text(after));
            shown.add(slot.key);
        };
        items.forEach((item, i) => {
            if (i > 0) pieces.push(text(' · '));
            say(item, 'category');
            say(item, 'count', ' ');
            if (!sharedDenominator) say(item, 'denominator', ' of ');
            const counted = isSaid(item.fields.get('count'));
            say(item, 'percentage', counted ? ' (' : ' ', counted ? '%)' : '%');
            if (!sharedFramework) say(item, 'reporting_framework', ' [', ']');
            if (checkDistribution(item.fields)?.matches === false)
                pieces.push({ kind: 'warn', item: item.at, text: ' ⚠' });
        });
        if (sharedDenominator) say(items[0], 'denominator', ' of ');
        if (frameworkSaid) say(items[0], 'reporting_framework', ', as ');
        for (const item of items) {
            for (const slot of item.fields.values()) {
                const folds = slot.kind === 'value' && !isSaid(slot) && isFolded(slot);
                this.place(slot, shown.has(slot.key) ? where : folds ? 'fold' : 'item', section, item, leftover);
                if (folds) {
                    item.folded.push(slot);
                } else if (!shown.has(slot.key)) {
                    item.detailsOnly.push(slot);
                    this.order.push(slot);
                }
            }
        }
        return pieces;
    }

    phrase(phrase: Phrase, section: string): Said {
        if (typeof phrase === 'string')
            return phrase.startsWith('$')
                ? this.slot({ slot: phrase.slice(1) }, section)
                : { pieces: [text(phrase)], shows: false };
        if (Array.isArray(phrase)) {
            const said = phrase.map((part) => this.phrase(part, section));
            return said.some((s) => s.shows) ? { pieces: said.flatMap((s) => s.pieces), shows: true } : NOTHING;
        }
        if ('parts' in phrase) {
            const kept = phrase.parts.map((part) => this.phrase(part, section)).filter((s) => s.shows);
            if (!kept.length) return NOTHING;
            return { pieces: kept.flatMap((s, i) => (i ? [text(phrase.join), ...s.pieces] : s.pieces)), shows: true };
        }
        if ('range' in phrase) return this.range(phrase, section);
        return this.slot(phrase, section);
    }

    private range({ range: [from, to], unit, centre }: Range, section: string): Said {
        const middle = centre === undefined ? NOTHING : this.phrase(centre, section);
        const unitOf = () => (unit === undefined ? NOTHING : this.slot({ slot: unit }, section));
        const units = middle.shows ? unitOf() : NOTHING;
        const [start, end] = [this.slot({ slot: from }, section), this.slot({ slot: to }, section)];
        const alone = middle.shows ? NOTHING : unitOf();
        const after = (said: Said) => (said.shows ? [text(' '), ...said.pieces] : []);
        /** The range's numbers, the unit after them where `unitAfter` holds it. */
        const span = (unitAfter: Piece[]): Piece[] => {
            if (start.shows && end.shows) return [...start.pieces, text('–'), ...end.pieces, ...unitAfter];
            if (start.shows) return [...start.pieces, ...unitAfter, text(' or older')];
            return [text('up to '), ...end.pieces, ...unitAfter];
        };
        const ranged = start.shows || end.shows;
        if (middle.shows)
            return {
                pieces: [...middle.pieces, ...after(units), ...(ranged ? [text(' ('), ...span([]), text(')')] : [])],
                shows: true,
            };
        if (ranged) return { pieces: span(after(alone)), shows: true };
        return alone.shows ? { pieces: [text('in'), ...after(alone)], shows: true } : NOTHING;
    }

    private slot({ slot: path, join }: SlotPhrase, section: string): Said {
        const listed = this.list(path, 'about', section, inWords(leafOf(path)).replace(/ distribution$/, ''));
        if (listed) return { pieces: listed.flatMap((item, i) => (i ? [text(' · '), ...item] : item)), shows: true };
        const slot = this.bySlot.get(path);
        if (!slot || this.has(slot.key)) return NOTHING;
        this.place(slot, 'about', section);
        if (isFolded(slot)) return NOTHING;
        return { pieces: [this.value(slot, valueWords(this.index, slot, join))], shows: true };
    }

    pairs(paths: string[], leftover?: boolean): Piece[] {
        const pieces: Piece[] = [];
        for (const path of paths) {
            const slot = this.bySlot.get(path);
            if (!slot || this.has(slot.key, leftover)) continue;
            this.place(slot, 'about', 'About', undefined, leftover);
            if (isFolded(slot)) continue;
            if (pieces.length) pieces.push(text(' · '));
            pieces.push(text(`${inWords(leafOf(path))} `), this.value(slot, valueWords(this.index, slot)));
        }
        return pieces;
    }

    row(path: string, label: string, leftover?: boolean): Row | undefined {
        const listed = this.list(path, 'row', label, label, leftover);
        if (listed) return { label, path, pieces: listed.flatMap((item, i) => (i ? [text(' · '), ...item] : item)) };
        const slot = this.bySlot.get(path);
        if (!slot || this.has(slot.key, leftover)) return undefined;
        this.place(slot, 'row', label, undefined, leftover);
        return isFolded(slot) ? undefined : { label, path, pieces: [this.value(slot, lineWords(this.index, slot))] };
    }

    link(path: string, label: string, leftover?: boolean): LinkGroup | undefined {
        const items = this.lists.get(path);
        if (items) {
            const listed = this.list(path, 'link', label, label, leftover);
            if (!listed) return undefined;
            return {
                label,
                path,
                chips: [...items.keys()].map((at, i) => ({ kind: 'item', item: at, pieces: listed[i] })),
            };
        }
        const slot = this.bySlot.get(path);
        if (!slot || this.has(slot.key, leftover)) return undefined;
        this.place(slot, 'link', label, undefined, leftover);
        if (isFolded(slot)) return undefined;
        if (slot.kind !== 'reference')
            return {
                label,
                path,
                chips: [{ kind: 'item', item: path, pieces: [this.value(slot, valueWords(this.index, slot))] }],
            };
        this.order.push(slot);
        const chips: Chip[] = slot.references.length
            ? slot.references.map((target) => ({
                  kind: 'link',
                  slot,
                  target,
                  name: this.index.entity(target)?.name ?? target,
              }))
            : [{ kind: 'none', slot }];
        return { label, path, chips };
    }
}

/** Joins a sentence's words: no space or comma left at its start, none doubled, none before punctuation. */
function tidy(pieces: Piece[]): Piece[] {
    const merged: Piece[] = [];
    for (const piece of pieces) {
        const last = merged.at(-1);
        if (piece.kind === 'text' && last?.kind === 'text') merged[merged.length - 1] = text(last.text + piece.text);
        else merged.push(piece);
    }
    return merged.flatMap((piece, i): Piece[] => {
        if (piece.kind !== 'text') return [piece];
        let words = piece.text
            .replace(/ {2,}/g, ' ')
            .replace(/ ([,.;])/g, '$1')
            .replace(/([,;])\1+/g, '$1');
        if (i === 0) words = words.replace(/^[\s,;]+/, '');
        return words ? [text(words)] : [];
    });
}

const SHORT = 40;

/** Whether a value reads as a short field: anything but a list, and a text of at most 40 characters. */
function isShort(slot: SlotNode) {
    const value = valueOf(slot);
    if (Array.isArray(value)) return false;
    return typeof value !== 'string' || value.length <= SHORT;
}

const NO_TEMPLATE: CardTemplate = { about: [] };

function layOut(index: RecordIndex, entity: EntityNode): CardLayout {
    const template = CARD_TEMPLATES[entity.schemaClass] ?? CARD_TEMPLATES[entity.entityClass] ?? NO_TEMPLATE;
    const built = new Builder(index, entity);
    const title = titleSlot(entity);
    if (title) {
        built.place(title, 'title', 'Title');
        built.order.push(title);
    }
    if (comparesTerms(entity)) {
        for (const slot of entity.slots.filter(isCellSlot)) built.place(slot, 'comparison', 'What is compared');
        built.order.push(...comparisonSlots(index, entity));
    }
    const named = new Set(templatePaths(template));
    const left = entity.slots.filter((slot) => !built.places.has(slot.key) && !claimedBy(named, slot));
    const leftList = (slot: SlotNode) => listOf(slot.path)?.list;

    const about = template.about
        .map((sentence) => built.phrase(sentence, 'About'))
        .filter((said) => said.shows)
        .map((said) => tidy(said.pieces));
    const pairs = [
        built.pairs(template.pairs ?? []),
        built.pairs(
            left.filter((s) => s.kind === 'value' && !leftList(s) && isShort(s)).map((s) => s.path),
            true
        ),
    ].filter((line) => line.length);
    const rows = (template.rows ?? []).flatMap((spec) => {
        const { slot, label } = typeof spec === 'string' ? { slot: spec, label: humanize(leafOf(spec)) } : spec;
        return built.row(slot, label) ?? [];
    });
    for (const slot of left) {
        if (built.places.has(slot.key) || slot.kind === 'reference') continue;
        const path = leftList(slot) ?? slot.path;
        const row = built.row(path, humanize(leafOf(path)), true);
        if (row) rows.push(row);
    }
    const links = (template.links ?? []).flatMap((spec) => built.link(spec.slot, spec.label) ?? []);
    for (const spec of template.children ?? []) {
        const held = spec.slot === undefined ? undefined : built.slotAt(spec.slot);
        if (held && !built.has(held.key)) built.place(held, 'link', spec.label);
        const children = index.visible.filter((e) => e.parent === entity.id && e.entityClass === spec.entityClass);
        if (children.length)
            links.push({
                label: spec.label,
                path: spec.slot,
                chips: children.map((child) => ({ kind: 'entity', entity: child })),
            });
    }
    for (const slot of left) {
        if (built.places.has(slot.key)) continue;
        const group = built.link(slot.path, inWords(leafOf(slot.path)), true);
        if (group) links.push(group);
    }
    return {
        title,
        about: [...about, ...pairs],
        rows,
        links,
        folded: built.folded,
        order: built.order,
        places: built.places,
        doubled: built.doubled,
    };
}

const layouts = new WeakMap<RecordIndex, WeakMap<EntityNode, CardLayout>>();

/** How the entity's card lays out its fields; worked out once for each index and entity. */
export function cardLayoutOf(index: RecordIndex, entity: EntityNode): CardLayout {
    return cached(
        cached(layouts, index, () => new WeakMap()),
        entity,
        () => layOut(index, entity)
    );
}

/**
 * The slots j and k walk on the entity's card, in the order it shows them: its title, an analysis's comparison chips,
 * its sentences, rows and links, then its folded fields while the fold is open.
 */
export function cardOrder(index: RecordIndex, entity: EntityNode, foldOpen: boolean): SlotNode[] {
    const layout = cardLayoutOf(index, entity);
    return foldOpen ? [...layout.order, ...layout.folded] : layout.order;
}
