import { STEPS, type StepId } from '../model/steps';
import { readKept, writeKept } from '../store/kept';

const KEY = 'neurostore-review:dismissed-step-hints:v1';

/** The steps whose hint the reviewer dismissed, on this device; none where the browser keeps nothing. */
export const readDismissed = (): StepId[] =>
    readKept(KEY, (kept) =>
        Array.isArray(kept) ? STEPS.map((step) => step.id).filter((id) => kept.includes(id)) : undefined
    ) ?? [];

export const writeDismissed = (steps: StepId[]) => writeKept(KEY, steps);
