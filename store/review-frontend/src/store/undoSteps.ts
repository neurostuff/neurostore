import type { Op } from '../contract/generated/review-ops';
import { randomUUID } from '../model/uuid';

/** An op as an inverse holds it: without the client_op_id it is sent with. */
export type InverseOp = Op extends infer O ? (O extends Op ? Omit<O, 'client_op_id'> : never) : never;

/** One user intent on the undo or redo stack: the client_op_ids of its ops, and the inverse the server gave each. */
export interface UndoStep {
    ops: string[];
    inverses: Record<string, InverseOp[]>;
    /** The step sending this one took off the other stack, put back if this one is dropped unapplied. */
    reverts?: UndoStep;
}

export interface UndoStacks {
    undoStack: UndoStep[];
    redoStack: UndoStep[];
}

/** Op types no op undoes; the server gives them no inverse. */
export const NOT_UNDONE = new Set<Op['type']>(['note']);

export const isReady = (step: UndoStep) => step.ops.every((id) => id in step.inverses);

/** The ops that undo `step`: each op's inverse, last op first, with fresh client_op_ids. */
export const undoing = (step: UndoStep): Op[] =>
    step.ops
        .toReversed()
        .flatMap((id) => step.inverses[id])
        .map((op) => ({ client_op_id: randomUUID(), ...op }) as Op);

/** The stacks with each op the server answered with an inverse given it, in `inverses` by client_op_id. */
export function answerSteps(stacks: UndoStacks, inverses: Map<string, InverseOp[]>): UndoStacks {
    const answered = (step: UndoStep): UndoStep => {
        const given = step.ops.filter((id) => inverses.has(id));
        if (given.length === 0) return step;
        return {
            ...step,
            inverses: {
                ...step.inverses,
                ...Object.fromEntries(given.map((id) => [id, inverses.get(id)!])),
            },
        };
    };
    return { undoStack: stacks.undoStack.map(answered), redoStack: stacks.redoStack.map(answered) };
}

/**
 * The undo and redo stacks once their ops that left pending unanswered are accounted for. A step with such
 * an op that the server stored is dropped, its inverse unknown. A step whose op was dropped unapplied gives
 * way to the step it reverts, back on its stack; a user step just loses the op.
 */
export function settled(stacks: UndoStacks, pending: Set<string>, stored: Set<string>): UndoStacks {
    const next = { undo: [...stacks.undoStack], redo: [...stacks.redoStack] };
    for (const [name, other] of [
        ['undo', 'redo'],
        ['redo', 'undo'],
    ] as const) {
        next[name] = next[name].flatMap((step) => {
            const lost = step.ops.filter((id) => !(id in step.inverses) && !pending.has(id));
            if (lost.length === 0) return [step];
            if (lost.some((id) => stored.has(id))) return [];
            if (step.reverts) {
                next[other].push(step.reverts);
                return [];
            }
            const ops = step.ops.filter((id) => !lost.includes(id));
            return ops.length ? [{ ...step, ops }] : [];
        });
    }
    return { undoStack: next.undo, redoStack: next.redo };
}

/**
 * The kind of each op a refused send reverted, 'undo' or 'redo' by the stack its step was sent from, and the ids
 * a refusal drops: the refused ops and every op of the steps they reverted.
 */
export function revertedBy(stacks: UndoStacks, refused: Set<string>) {
    const sentBy = (steps: UndoStep[], kind: 'undo' | 'redo') =>
        steps.filter((s) => s.reverts && s.ops.some((id) => refused.has(id))).map((step) => ({ step, kind }));
    const reverted = [...sentBy(stacks.redoStack, 'undo'), ...sentBy(stacks.undoStack, 'redo')];
    const kinds: Record<string, 'undo' | 'redo'> = {};
    for (const { step, kind } of reverted) for (const id of step.ops) kinds[id] = kind;
    const dropped = new Set([...refused, ...reverted.flatMap(({ step }) => step.ops)]);
    return { kinds, dropped };
}
