import type { ReviewBundle, StoredOp } from '../contract/generated/review-bundle';
import type { Op } from '../contract/generated/review-ops';
import { currentAnalyses, inPlaceOf, successor, type CoordinateAnalysis, type CoordinatePoint } from './coordinates';

type CoordinateOp = Extract<Op, { type: 'coordinate' }>;

export const isCoordinate = (op: Op): op is CoordinateOp => op.type === 'coordinate';

/** Whether `op` is an edit_points of the analysis `key`. */
export const isEditPoints = (op: Op, key?: string): op is CoordinateOp & { payload: { points: CoordinatePoint[] } } =>
    isCoordinate(op) &&
    op.action === 'edit_points' &&
    op.target.kind === 'coordinate_analysis' &&
    (key === undefined || op.target.analysis_key === key);

/** The analysis keys an op names: its coordinate analysis target and, for a merge, the analyses it takes. */
export function keysNamed(op: Op): string[] {
    if (!('target' in op) || op.target.kind !== 'coordinate_analysis') return [];
    const merged = isCoordinate(op) && op.payload && 'with' in op.payload ? op.payload.with : [];
    return [op.target.analysis_key, ...merged];
}

/** The analysis keys a coordinate op may replace once applied: those it names, and those a restore takes away. */
export function keysChanged(op: Op): string[] {
    if (!isCoordinate(op)) return [];
    if (op.action === 'restore') {
        const removed = (op.payload as { remove?: { analysis: { key: string } }[] } | undefined)?.remove ?? [];
        return removed.map((entry) => entry.analysis.key);
    }
    return keysNamed(op);
}

/** The op with each analysis key it names put through `to`. */
export function aimedAt(op: Op, to: (key: string) => string): Op {
    const keys = keysNamed(op);
    if (keys.every((key) => to(key) === key)) return op;
    const [first, ...merged] = keys.map(to);
    const next = { ...op, target: { kind: 'coordinate_analysis', analysis_key: first } } as Op;
    if (!isCoordinate(next) || !merged.length) return next;
    return { ...next, payload: { ...next.payload, with: merged } } as Op;
}

type Entry = { index: number; analysis: CoordinateAnalysis };

const entriesOf = (side: StoredOp['before'] | undefined) =>
    Array.isArray(side?.analyses) ? (side.analyses as Entry[]) : [];

/** The keys each coordinate op of `stored` put in place of each key it took away, in seq order. */
export function replacementsIn(stored: StoredOp[]): Map<string, string[]> {
    const replaced = new Map<string, string[]>();
    for (const { op, before, after } of stored) {
        if (op.type !== 'coordinate') continue;
        const removed = entriesOf(before).map((entry) => entry.analysis.key);
        const inserted = entriesOf(after).map((entry) => entry.analysis.key);
        const added = inserted.filter((key) => !removed.includes(key));
        for (const key of removed) if (!inserted.includes(key)) replaced.set(key, added);
    }
    return replaced;
}

const newOps = (before: ReviewBundle, next: ReviewBundle) => {
    const seqs = new Set(before.ops.map((stored) => stored.seq));
    return next.ops.filter((stored) => !seqs.has(stored.seq));
};

/**
 * What took the place of each analysis of `before` in `next`, by `inPlaceOf` over the ops `stored`: by default those
 * `next` adds to `before`'s.
 */
export function followerOf(before: ReviewBundle, next: ReviewBundle, stored = newOps(before, next)) {
    const was = currentAnalyses(before);
    const now = currentAnalyses(next);
    const replaced = replacementsIn(stored);
    return {
        was,
        now,
        present: new Set(now.map((analysis) => analysis.key)),
        follow: (key: string): CoordinateAnalysis[] => inPlaceOf(was, now, key, replaced),
        successor: (key: string) => successor(was, now, key, replaced),
    };
}

export type Follower = ReturnType<typeof followerOf>;
