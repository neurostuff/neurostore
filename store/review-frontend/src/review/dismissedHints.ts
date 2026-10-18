import { STEPS, type StepId } from '../model/steps';

const KEY = 'neurostore-review:dismissed-step-hints:v1';

/** The steps whose hint the reviewer dismissed, on this device; none where the browser keeps nothing. */
export function readDismissed(): StepId[] {
    try {
        const kept: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
        return Array.isArray(kept) ? STEPS.map((step) => step.id).filter((id) => kept.includes(id)) : [];
    } catch {
        return [];
    }
}

export function writeDismissed(steps: StepId[]) {
    try {
        localStorage.setItem(KEY, JSON.stringify(steps));
    } catch {
        // A browser that keeps nothing shows the hint again next time.
    }
}
