export type Json = Record<string, unknown>;
export type Step = string | number;

const STEP = /^([^[\]]+)(?:\[#(\d+)\])?$/;

export const isObject = (value: unknown): value is Json =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

export function parsePath(path: string): Step[] {
    return path.split('.').flatMap((part): Step[] => {
        const match = STEP.exec(part);
        if (!match) throw new Error(`cannot read the path ${path}`);
        return match[2] === undefined ? [match[1]] : [match[1], Number(match[2])];
    });
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
