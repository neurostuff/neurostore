import type { ReviewBundle } from '../contract/generated/review-bundle';
import type { ProvenanceMap } from '../model/applyOp';
import { stepProgress } from '../model/guided';
import type { RecordIndex } from '../model/record';
import type { StepId } from '../model/steps';
import type { SessionState } from '../store/sessionStore';

/** How far a step is: its count as the step bar, its cards and its prompt show it. */
export interface StepProgress {
    done: number;
    total: number;
    /** `done of total`; '' for submit. */
    text: string;
    /** Whether every item the step asks the reviewer to judge is judged; never for submit. */
    complete: boolean;
}

interface Remembered {
    bundle: ReviewBundle;
    provenance: ProvenanceMap;
    steps: Map<StepId, StepProgress>;
}

const remembered = new WeakMap<RecordIndex, Remembered>();

function progressOf(s: SessionState, step: StepId): StepProgress {
    const progress = stepProgress(s, step);
    if (!progress) return { done: 0, total: 0, text: '', complete: false };
    const { done, total } = progress;
    return { done, total, text: `${done} of ${total}`, complete: done === total };
}

/** The progress of `step`, the same object for as long as the index, the bundle and the provenance are the same. */
export function selectStepProgress(s: SessionState, step: StepId): StepProgress {
    let known = remembered.get(s.index);
    if (!known || known.bundle !== s.bundle || known.provenance !== s.provenance) {
        known = { bundle: s.bundle, provenance: s.provenance, steps: new Map() };
        remembered.set(s.index, known);
    }
    let progress = known.steps.get(step);
    if (!progress) known.steps.set(step, (progress = progressOf(s, step)));
    return progress;
}
