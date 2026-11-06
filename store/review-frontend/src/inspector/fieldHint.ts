import { classWords, inWords, labelOf } from '../model/labels';
import type { RecordIndex } from '../model/record';
import { descriptionOf } from '../model/schema';
import { useSession } from '../store/context';

const SENTENCE_END = /(?<!\b(?:e\.g|i\.e|cf|vs|etc))[.!?](?=\s)|\n/;

/** A description's first sentence. */
export function firstSentence(description: string): string {
    const end = SENTENCE_END.exec(description);
    if (!end) return description;
    return description.slice(0, end[0] === '\n' ? end.index : end.index + 1);
}

const drop = () => '';

/** Developer references a reviewer cannot act on, each a whole clause, sentence or parenthesis. */
const DEVELOPER_CLAUSES: [RegExp, (found: string, first: string) => string][] = [
    [/\s*See [\w-]+\.md\b[^.\n]*\./g, drop],
    [/\s*The \w+ is stated once, in [\w-]+\.md(?: §[\d.]*\d)?\./g, drop],
    [/(?:,| --) and [^.\n]*? in [\w-]+\.md(?: §[\d.]*\d)?(?=\.)/g, drop],
    [/\s*\(`?[\w-]+\.md`?(?: §[\d.]*\d)?\)/g, drop],
    [/\s*\(§[\d.]*\d\)/g, drop],
    [/[,:] `analysis#<h>`(?:, the same key `[^`]+` names)?, where `h` hashes [^.]*?\bpoints\b(?=[,.])/g, drop],
    [/\bSet by `[^`]+` and (\w)/g, (_, first) => first.toUpperCase()],
];

const PASCAL = '[A-Z][a-z]+(?:[A-Z][a-z]*)*';
const CLASS_CODE = new RegExp(`^(${PASCAL})(?:\\.([a-z][a-z0-9_]*))?$`);
const NAMES_CODE = /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)*$/;
const BARE_CLASS_FIELD = new RegExp(`\\b(${PASCAL})\\.([a-z][a-z0-9_]*)\\b`, 'g');
const BARE_SNAKE = /\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/g;
const CODE = /`([^`]*)`/g;

const classField = (name: string, field?: string) =>
    field === undefined ? classWords(name) : `${classWords(name)} ${inWords(field)}`;

/** Text with its `Class.field` and snake_case names in words, the rest as written. */
const namesInWords = (text: string) =>
    text
        .replace(BARE_CLASS_FIELD, (_, name: string, field: string) => classField(name, field))
        .replace(BARE_SNAKE, inWords);

/**
 * A code span in words: a class name, with a field, or field names; any other code, such as an example value, as
 * written but for its `Class.field` and snake_case names.
 */
function codeInWords(code: string): string {
    const named = CLASS_CODE.exec(code);
    if (named) return classField(named[1], named[2]);
    return NAMES_CODE.test(code) ? code.split('.').map(inWords).join(' ') : namesInWords(code);
}

/**
 * A description as the reviewer reads it: its developer references left out, each code span in words (`effect.cells`
 * as effect cells) or as written, and bare `Class.field` and snake_case names in words.
 */
export function inProse(description: string): string {
    const said = DEVELOPER_CLAUSES.reduce((text, [clause, by]) => text.replace(clause, by), description);
    return said
        .split(CODE)
        .map((part, i) => (i % 2 ? codeInWords(part) : namesInWords(part)))
        .join('');
}

const prose = new Map<string, string>();

/** The schema's description of the field at `path` on an item of `className`, in prose; undefined where it has none. */
export function describedInProse(className: string, path: string): string | undefined {
    const description = descriptionOf(className, path);
    if (description === undefined) return undefined;
    let said = prose.get(description);
    if (said === undefined) prose.set(description, (said = inProse(description)));
    return said;
}

const proseOf = (index: RecordIndex, slot: { entity: string; path: string }) => {
    const className = index.entity(slot.entity)?.schemaClass;
    return className === undefined ? undefined : describedInProse(className, slot.path);
};

type SlotAt = { key: string; entity: string; path: string };

/** A slot's hover hint, `<label>: <description>`; undefined where the schema describes it not. */
export function fieldHint(index: RecordIndex, slot: SlotAt): string | undefined {
    const description = proseOf(index, slot);
    return description === undefined ? undefined : `${labelOf(index, slot)}: ${description}`;
}

export const useDescription = (slot: { entity: string; path: string }) => useSession((s) => proseOf(s.index, slot));

export const useFieldHint = (slot: SlotAt) => useSession((s) => fieldHint(s.index, slot));
