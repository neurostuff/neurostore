import { readKept, writeKept } from './kept';

const KEY = 'neurostore-review:open-folds:v1';

/** The classes whose cards this device keeps the fold of unreported fields open on. */
export const readFolds = (): string[] =>
    readKept(KEY, (kept) =>
        Array.isArray(kept) && kept.every((name) => typeof name === 'string') ? kept : undefined
    ) ?? [];

export const writeFolds = (classes: string[]) => writeKept(KEY, classes);
