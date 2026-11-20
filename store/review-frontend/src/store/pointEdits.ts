import type { EditPointsPayload, Op } from '../contract/generated/review-ops';
import { analysisKeyOf, isCoordinate, isEditPoints, keysChanged, type Follower } from '../model/analysisFollow';
import { clamp } from '../model/coordinateFocus';
import { guidedOrder, type CoordinateAnalysis, type CoordinatePoint } from '../model/coordinates';

/** Why the reviewer's work is kept unsent, and the analysis it may be applied to instead. */
export interface Kept {
    message: string;
    guess?: string;
}

/**
 * One edit the reviewer made to the points of the analysis `key` (named `name` then), collected until it is sent:
 * the points before and after. `held` says why it is not sent until the reviewer edits the analysis again or
 * discards it: the server refused it.
 */
export interface PointEdit {
    key: string;
    name: string;
    base: CoordinatePoint[];
    points: CoordinatePoint[];
    held?: Kept;
}

const sortedKeys = (_: string, value: unknown) =>
    value && typeof value === 'object' && !Array.isArray(value)
        ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
        : value;

const canonical = (value: unknown) => JSON.stringify(value, sortedKeys);

/** Whether two lists of points hold the same values, whatever the order of their fields. */
export const samePoints = (a: unknown, b: unknown) => a === b || canonical(a) === canonical(b);

/** The analysis keys the pending ops may replace: their analyses show as saving until the results land. */
export const pendingKeys = ({ pending }: { pending: Op[] }) => new Set(pending.flatMap(keysChanged));

/** The points of the analysis `key` the last pending edit_points of it gives; undefined when there is none. */
const pendingPoints = (pending: Op[], key: string) => {
    const op = pending.findLast((candidate) => isEditPoints(candidate, key));
    return op && isEditPoints(op) ? op.payload.points : undefined;
};

/** The points of the analysis `key` of `analyses` once `pending` is applied: its last pending edit_points's, else its own. */
export const pointsAfter = (analyses: CoordinateAnalysis[], pending: Op[], key: string) =>
    pendingPoints(pending, key) ?? analyses.find((analysis) => analysis.key === key)?.points;

type ShownFields = Partial<Pick<CoordinateAnalysis, 'name' | 'role' | 'coordinate_space'>>;

/** The name, role and coordinate space the pending ops of the analysis `key` give it, each set by the last that sets it. */
export function pendingFields(pending: Op[], key: string): ShownFields {
    const fields: ShownFields = {};
    for (const op of pending) {
        if (!isCoordinate(op) || analysisKeyOf(op) !== key) continue;
        if (op.action === 'relabel' && op.role) fields.role = op.role;
        if (!isEditPoints(op)) continue;
        const { name, coordinate_space } = op.payload as EditPointsPayload;
        if (name !== undefined) fields.name = name;
        if (coordinate_space !== undefined) fields.coordinate_space = coordinate_space;
    }
    return fields;
}

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
export function guessFor(follower: Follower, key: string): string | undefined {
    const placed = guidedOrder(follower.was, true).findIndex((analysis) => analysis.key === key);
    if (placed === -1) return undefined;
    const order = guidedOrder(follower.now, true);
    return order[clamp(placed, order.length - 1)]?.key;
}

export const KEPT_EDITS = 'the analysis was replaced before they could be sent';

/**
 * The collected edits on the analyses the follower leads to: those on an analysis replaced follow it, moved or
 * placed by `carryEdit`; those its lone replacement already holds are sent; those that cannot be placed, and those
 * the server refused, leave the collected edits as stranded, one per analysis, with why and a guess where one is.
 */
export function followCollected(collected: PointEdit[], follower: Follower) {
    const stranded: { edit: PointEdit; kept: Kept }[] = [];
    let next = collected;
    for (const edit of collectedByAnalysis(collected)) {
        if (follower.present.has(edit.key)) continue;
        const targets = follower.follow(edit.key);
        const others = next.filter((entry) => entry.key !== edit.key);
        if (!edit.held && targets.length === 1 && samePoints(targets[0].points ?? [], edit.points)) {
            next = others;
            continue;
        }
        const carried = !edit.held && targets.length ? carryEdit(edit.base, edit.points, targets) : undefined;
        if (carried?.kind === 'moved') {
            next = next.map((entry) => (entry.key === edit.key ? { ...entry, key: carried.key } : entry));
            continue;
        }
        if (!carried) {
            next = others;
            stranded.push({
                edit,
                kept: {
                    message: edit.held?.message ?? KEPT_EDITS,
                    guess: edit.held?.guess ?? guessFor(follower, edit.key),
                },
            });
            continue;
        }
        const at = next.findIndex((entry) => entry.key === edit.key);
        const placed = carried.parts.map((part) => ({ ...part, name: edit.name }));
        next = [...others.slice(0, at), ...placed, ...others.slice(at)];
    }
    return { collected: next, stranded };
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
        const key = analysisKeyOf(op);
        if (!isEditPoints(op) || key === undefined) continue;
        const base = serverPoints(key);
        const own = next.filter((entry) => entry.key === key);
        const entries = own.length ? own : [{ key, name: nameOf(key), base, points: op.payload.points }];
        const held = { message };
        const kept = entries.map((entry, i) => ({ ...entry, ...(i === 0 && { base }), held }));
        next = [...next.filter((entry) => entry.key !== key), ...kept];
    }
    return next;
}
