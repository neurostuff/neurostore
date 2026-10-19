import type { Op } from '../contract/generated/review-ops';
import { aimedAt, isEditPoints, keysChanged, type Follower } from '../model/analysisFollow';
import { clamp } from '../model/coordinateFocus';
import { guidedOrder, type CoordinateAnalysis, type CoordinatePoint } from '../model/coordinates';

/**
 * One edit the reviewer made to the points of the analysis `key` (named `name` then), collected until it is sent:
 * the points before and after. `held` says why it is not sent until the reviewer edits the analysis again, applies
 * or discards it: the server refused it, or the analysis it was made on was replaced and it could not follow.
 */
export interface PointEdit {
    key: string;
    name: string;
    base: CoordinatePoint[];
    points: CoordinatePoint[];
    held?: { message: string; guess?: string };
}

const sortedKeys = (_: string, value: unknown) =>
    value && typeof value === 'object' && !Array.isArray(value)
        ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
        : value;

const canonical = (value: unknown) => JSON.stringify(value, sortedKeys);

/** Whether two lists of points hold the same values, whatever the order of their fields. */
export const samePoints = (a: unknown, b: unknown) => a === b || canonical(a) === canonical(b);

/** The analysis keys the pending ops may replace; no collected edit to one is sent until their results land. */
export const pendingKeys = ({ pending }: { pending: Op[] }) => new Set(pending.flatMap(keysChanged));

/** Whether a pending op may replace any of `keys`. */
export const waitsOnKeys = (s: { pending: Op[] }, keys: string[]) => {
    const held = pendingKeys(s);
    return keys.some((key) => held.has(key));
};

/** The points of the analysis `key` the last pending edit_points of it gives; undefined when there is none. */
export const pendingPoints = (pending: Op[], key: string) => {
    const op = pending.findLast((candidate) => isEditPoints(candidate, key));
    return op && isEditPoints(op) ? op.payload.points : undefined;
};

/** The collected edits grouped by analysis, in the order each was first edited: the first base and the latest points. */
export function collectedByAnalysis(collected: PointEdit[]): PointEdit[] {
    const byKey = new Map<string, PointEdit>();
    for (const edit of collected) {
        const held = byKey.get(edit.key);
        byKey.set(edit.key, held ? { ...held, points: edit.points, held: edit.held } : edit);
    }
    return [...byKey.values()];
}

type Carried =
    | { kind: 'moved'; key: string }
    | { kind: 'placed'; parts: { key: string; base: CoordinatePoint[]; points: CoordinatePoint[] }[] };

/**
 * Where an edit from `base` to `points` goes once `targets` are in place of the analysis it was made on: moved whole
 * onto a lone target still holding `base`, else each changed point placed where its old value now is, on the targets
 * it changes. Undefined when it cannot be placed: it adds or removes points, or a changed point is in none of them.
 */
export function carryEdit(
    base: CoordinatePoint[],
    points: CoordinatePoint[],
    targets: CoordinateAnalysis[]
): Carried | undefined {
    if (targets.length === 1 && samePoints(targets[0].points ?? [], base))
        return { kind: 'moved', key: targets[0].key };
    if (base.length !== points.length) return undefined;
    const carried = targets.map((t) => ({
        key: t.key,
        base: t.points ?? [],
        points: [...(t.points ?? [])],
        changed: false,
    }));
    const taken = new Set<CoordinatePoint>();
    for (const [i, was] of base.entries()) {
        if (samePoints(was, points[i])) continue;
        const into = carried.find((t) => t.points.some((p) => !taken.has(p) && samePoints(p, was)));
        if (!into) return undefined;
        const at = into.points.findIndex((p) => !taken.has(p) && samePoints(p, was));
        into.points[at] = points[i];
        into.changed = true;
        taken.add(points[i]);
    }
    return {
        kind: 'placed',
        parts: carried
            .filter((t) => t.changed)
            .map(({ key, base: from, points: to }) => ({ key, base: from, points: to })),
    };
}

/** The analysis now in the guided place of `key`, the guess an edit that could not follow it may be applied to. */
function guessFor(follower: Follower, key: string): string | undefined {
    const placed = guidedOrder(follower.was, true).findIndex((analysis) => analysis.key === key);
    if (placed === -1) return undefined;
    const order = guidedOrder(follower.now, true);
    return order[clamp(placed, order.length - 1)]?.key;
}

export const KEPT_EDITS = 'the analysis was replaced before they could be sent';

/**
 * The collected edits on the analyses the follower leads to: those on an analysis replaced follow it, moved or
 * placed by `carryEdit`; those its replacement already holds are sent; those that cannot be placed are kept, held,
 * with a guess where one is, and listed as stranded, one per analysis.
 */
export function followCollected(collected: PointEdit[], follower: Follower) {
    const stranded: PointEdit[] = [];
    let next = collected;
    for (const edit of collectedByAnalysis(collected)) {
        if (follower.present.has(edit.key) || edit.held) continue;
        const targets = follower.follow(edit.key);
        const others = next.filter((entry) => entry.key !== edit.key);
        if (targets.some((target) => samePoints(target.points ?? [], edit.points))) {
            next = others;
            continue;
        }
        const carried = targets.length ? carryEdit(edit.base, edit.points, targets) : undefined;
        if (carried?.kind === 'moved') {
            next = next.map((entry) => (entry.key === edit.key ? { ...entry, key: carried.key } : entry));
            continue;
        }
        if (!carried) {
            const held = { message: KEPT_EDITS, guess: guessFor(follower, edit.key) };
            next = next.map((entry) => (entry.key === edit.key ? { ...entry, held } : entry));
            stranded.push({ ...edit, held });
            continue;
        }
        const at = next.findIndex((entry) => entry.key === edit.key);
        const placed = carried.parts.map((part) => ({ ...part, name: edit.name }));
        next = [...others.slice(0, at), ...placed, ...others.slice(at)];
    }
    return { collected: next, stranded };
}

/**
 * The one path that re-aims the reviewer's work once the follower's analyses replace the ones it was made on: each
 * pending op aimed at the analysis that took its key's place, and the collected edits followed by `followCollected`.
 */
export function followAnalyses(follower: Follower, pending: Op[], collected: PointEdit[]) {
    const to = (key: string) => (follower.present.has(key) ? key : (follower.successor(key) ?? key));
    return { pending: pending.map((op) => aimedAt(op, to)), ...followCollected(collected, follower) };
}

/**
 * The collected edits once the edit_points ops of `refused` are refused: each analysis they would have changed
 * keeps the reviewer's latest points, collected over the server's points `serverPoints` gives and held with the
 * refusal's message; an analysis with no later edit gets one with the refused op's points.
 */
export function keptThroughRefusal(
    collected: PointEdit[],
    refused: { op: Op; message: string }[],
    serverPoints: (key: string) => CoordinatePoint[],
    nameOf: (key: string) => string
): PointEdit[] {
    let next = collected;
    for (const { op, message } of refused) {
        if (!isEditPoints(op) || op.target.kind !== 'coordinate_analysis') continue;
        const key = op.target.analysis_key;
        const base = serverPoints(key);
        const own = next.filter((entry) => entry.key === key);
        const entries = own.length ? own : [{ key, name: nameOf(key), base, points: op.payload.points }];
        const held = { message };
        const kept = entries.map((entry, i) => ({ ...entry, ...(i === 0 && { base }), held }));
        next = [...next.filter((entry) => entry.key !== key), ...kept];
    }
    return next;
}
