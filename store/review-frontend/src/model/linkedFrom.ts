import type { RelationshipTarget } from '../contract/generated/review-ops';
import { CARD_TEMPLATES } from './cardTemplates';
import { guidedCards, pushTo, type Link } from './guided';
import { classWords, humanize, inWords, plural, singular, slotItem } from './labels';
import { parsePath, ROOT_ENTITY } from './paths';
import type { EntityNode, RecordIndex } from './record';
import { referenceSlotOf } from './schema';
import { relationshipKey, relationshipTarget } from './targetKey';

/** What the slot holds the target as: its subject (`level 2 ('MNPs')`), if any, and the rest of the clause. */
interface Role {
    subject?: string;
    predicate: string;
}

/** A link into an entity, said as `lead`, the linker's name in quotes, then `rest`. */
export interface SaidLink extends Link {
    /** The link's focus and provenance key. */
    key: string;
    target: RelationshipTarget;
    /** The entity the linker is nested in, where it is not the study. */
    parent?: EntityNode;
    role: Role;
    lead: string;
    rest: string;
}

/** Links alike, said once as `lead` (`In 6 model estimations`) then `rest`. */
export interface LinkGroup {
    kind: 'many';
    links: SaidLink[];
    lead: string;
    rest: string;
}

/**
 * Links into an entity: one, or several the same but for their linkers: nested linkers of one class and name in
 * parents of one class, or linkers of one class nested in nothing, holding the entity in the same role.
 */
export type LinkedEntry = { kind: 'one'; link: SaidLink } | LinkGroup;

/** The sentence a link or a group of links reads as. */
export const sentenceOf = (said: SaidLink | LinkGroup) =>
    'entity' in said ? `${said.lead} '${said.entity.name}'${said.rest}` : `${said.lead}${said.rest}`;

/** The link of the card template of `entity` naming the slot `path`, its list places left out. */
const templateLink = (entity: EntityNode, path: string) =>
    CARD_TEMPLATES[entity.schemaClass]?.links?.find((link) => link.slot === path.replace(/\[#\d+\]/g, ''));

/** What the linker's slot holds the target as, in words: a list item by its place and name, else the slot as its card names it. */
function roleOf(index: RecordIndex, { entity, slot }: Link, target: EntityNode): Role {
    const object = `this ${classWords(target.entityClass)}`;
    const item = slotItem(index, slot);
    if (item) {
        const leaf = item.leaf.map(inWords).join(' ');
        const said = leaf && !classWords(target.entityClass).endsWith(singular(leaf)) ? ` ${leaf}` : '';
        const owners = item.owners.map((owner) => `${inWords(owner)}'s `).join('');
        const name = item.name ? ` ('${item.name}')` : '';
        return {
            subject: `${owners}${inWords(singular(item.list))} ${item.place + 1}${name}${said}`,
            predicate: `${slot.references.length > 1 ? 'includes' : 'is'} ${object}`,
        };
    }
    const link = templateLink(entity, slot.path);
    if (link?.verb) return { predicate: `${link.verb} ${object}` };
    const subject = link?.label ?? inWords(String(parsePath(slot.path).at(-1)));
    const many = referenceSlotOf(
        { entity_class: entity.entityClass, schema_class: entity.schemaClass },
        slot.path
    )?.multivalued;
    return { subject, predicate: `${many ? (subject.endsWith('s') ? 'include' : 'includes') : 'is'} ${object}` };
}

const roleText = ({ subject, predicate }: Role) => (subject ? `${subject} ${predicate}` : predicate);

/** The role as a clause about the linker, `who` doing it where the role has no subject: `its group 2 is …`. */
const roleClause = (role: Role, who: string) => (role.subject ? `its ${roleText(role)}` : `${who} ${role.predicate}`);

/** The words a parent's card names its children of the linker's class by: `term` for a model estimation's. */
function childWords(parent: EntityNode, entity: EntityNode) {
    const listed = CARD_TEMPLATES[parent.schemaClass]?.children?.find((c) => c.entityClass === entity.entityClass);
    return listed ? singular(listed.label) : classWords(entity.entityClass);
}

function say(index: RecordIndex, link: Link, target: EntityNode): SaidLink {
    const { entity, slot } = link;
    const parent = entity.parent && entity.parent !== ROOT_ENTITY ? index.entity(entity.parent) : undefined;
    const role = roleOf(index, link, target);
    const within = parent ? ` in ${classWords(parent.entityClass)} '${parent.name}'` : '';
    return {
        ...link,
        key: relationshipKey(entity.id, slot.path, target.id),
        target: relationshipTarget(entity.id, slot.path, target.id),
        parent,
        role,
        lead: humanize(classWords(entity.entityClass)),
        rest: `${within}: ${roleClause(role, 'it')}`,
    };
}

/** Links alike, said once: by their parents' class and the term's name, or by their own class. */
function groupOf(links: SaidLink[]): LinkGroup {
    const [{ parent, entity, role }] = links;
    const lead = `In ${links.length} ${plural(classWords((parent ?? entity).entityClass))}`;
    const rest = parent
        ? `: the ${childWords(parent, entity)} '${entity.name}'${role.subject ? `, ${roleText(role)}` : ` ${role.predicate}`}`
        : `: ${roleClause(role, 'each')}`;
    return { kind: 'many', links, lead, rest };
}

const entriesOf = new WeakMap<RecordIndex, Map<string, LinkedEntry[]>>();

/**
 * The links into `target`, each as a sentence, in the guided order of their linkers; links alike as `LinkedEntry`
 * says are one entry, said once for them all.
 */
export function linkedFrom(index: RecordIndex, target: EntityNode): LinkedEntry[] {
    let byTarget = entriesOf.get(index);
    if (!byTarget) entriesOf.set(index, (byTarget = new Map()));
    const known = byTarget.get(target.id);
    if (known) return known;
    const { places, linksInto } = guidedCards(index);
    const place = (link: Link) => places.get(link.entity.id) ?? places.size;
    const alike = new Map<string, SaidLink[]>();
    for (const link of linksInto(target.id).toSorted((a, b) => place(a) - place(b))) {
        const said = say(index, link, target);
        const linker = said.parent ? [said.parent.entityClass, said.entity.name] : [];
        pushTo(alike, [said.entity.entityClass, ...linker, roleText(said.role)].join('\n'), said);
    }
    const entries = [...alike.values()].map((links): LinkedEntry =>
        links.length === 1 ? { kind: 'one', link: links[0] } : groupOf(links)
    );
    byTarget.set(target.id, entries);
    return entries;
}
