export type Json = Record<string, unknown>;
export type Step = string | number;

const NAME = '[A-Za-z_][A-Za-z0-9_]*';
const STEP = new RegExp(`^(${NAME})(?:\\[#(\\d+)\\])?$`);
const KEYED = new RegExp(`^${NAME}\\[${NAME}=[^\\]]*\\]$`);

/** A path that selects list items by key, which only the server resolves. */
export class NotLocal extends Error {
    constructor(path: string) {
        super(`field path '${path}' selects an item by key; the server applies it`);
        this.name = 'NotLocal';
    }
}

export const isKeyedPath = (path: string) => path.split('.').some((part) => KEYED.test(part));

export const isObject = (value: unknown): value is Json =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

/** An attribute and the position of the list item it selects, or null for none. */
type PathStep = readonly [attribute: string, position: number | null];

function pathSteps(path: string): PathStep[] {
    return path.split('.').map((part): PathStep => {
        const match = STEP.exec(part);
        if (!match) {
            if (isKeyedPath(part)) throw new NotLocal(path);
            throw new Error(`malformed field path '${path}'`);
        }
        return [match[1], match[2] === undefined ? null : Number(match[2])];
    });
}

export function parsePath(path: string): Step[] {
    return pathSteps(path).flatMap(([attribute, position]): Step[] =>
        position === null ? [attribute] : [attribute, position]
    );
}

function selected(value: unknown, position: number | null, path: string): unknown {
    if (position === null) return value;
    if (!Array.isArray(value)) throw new Error(`field path '${path}' selects an item of a non-list`);
    if (position >= value.length) throw new Error(`field path '${path}': no item at position ${position}`);
    return value[position];
}

const nonObject = (path: string) => new Error(`field path '${path}' goes through a non-object`);

/** The object holding the last step of a field path below `item`, with that step; undefined where a step is absent. */
export function ownerOf(item: unknown, path: string): { owner: unknown; attribute: string; position: number | null } {
    const steps = pathSteps(path);
    let owner: unknown = item;
    for (const [attribute, position] of steps.slice(0, -1)) {
        if (owner === undefined || owner === null) break;
        if (!isObject(owner)) throw nonObject(path);
        owner = selected(owner[attribute], position, path);
    }
    const [attribute, position] = steps[steps.length - 1];
    return { owner, attribute, position };
}

/** The value at a field path below `item`; undefined where an attribute is absent. */
export function readPath(item: unknown, path: string): unknown {
    const { owner, attribute, position } = ownerOf(item, path);
    if (owner === undefined || owner === null) return undefined;
    if (!isObject(owner)) throw nonObject(path);
    return selected(owner[attribute], position, path);
}

/** `item` with `value` at a field path, creating absent objects on the way. */
export function writePath(item: Json, path: string, value: unknown): Json {
    const write = (current: unknown, [[attribute, position], ...rest]: PathStep[]): Json => {
        if (!isObject(current)) throw nonObject(path);
        if (position === null) {
            const next = rest.length === 0 ? value : write(current[attribute] ?? {}, rest);
            return { ...current, [attribute]: next };
        }
        const chosen = selected(current[attribute], position, path);
        const next = rest.length === 0 ? value : write(chosen, rest);
        return { ...current, [attribute]: setIn(current[attribute], [position], next) };
    };
    return write(item, pathSteps(path));
}

export function getIn(value: unknown, steps: readonly Step[]): unknown {
    let current = value;
    for (const step of steps) {
        if (typeof current !== 'object' || current === null) return undefined;
        current = (current as Record<Step, unknown>)[step];
    }
    return current;
}

export function setIn<T>(value: T, steps: readonly Step[], next: unknown): T {
    if (steps.length === 0) return next as T;
    const [step, ...rest] = steps;
    const child = setIn((value as Record<Step, unknown>)[step], rest, next);
    if (Array.isArray(value)) return value.map((item, i) => (i === step ? child : item)) as T;
    return { ...value, [step]: child };
}

export const ROOT_ENTITY = 'study';

export function entityPath(record: Json, id: string): Step[] | null {
    if (id === ROOT_ENTITY) return [];
    const search = (value: unknown, at: Step[]): Step[] | null => {
        if (Array.isArray(value)) {
            for (let i = 0; i < value.length; i++) {
                const found = search(value[i], [...at, i]);
                if (found) return found;
            }
        } else if (isObject(value)) {
            if (at.length > 0 && value.local_id === id) return at;
            for (const [key, child] of Object.entries(value)) {
                const found = typeof child === 'object' ? search(child, [...at, key]) : null;
                if (found) return found;
            }
        }
        return null;
    };
    return search(record, []);
}
