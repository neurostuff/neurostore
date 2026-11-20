import type { Op } from '../contract/generated/review-ops';
import { aimedAt, analysisKeyOf, isCoordinate, isEditPoints, keysNamed, type Follower } from '../model/analysisFollow';
import type { CoordinateAnalysis, CoordinatePoint } from '../model/coordinates';
import { randomUUID } from '../model/uuid';
import { guessFor, pointsAfter, samePoints, type Kept, type PointEdit } from './pointEdits';

/** The points an op was made on; `collected` when it sent the reviewer's collected point edits. */
export interface Basis {
    points: CoordinatePoint[];
    collected?: true;
}

/** The basis of each op made on its analysis's points, by client_op_id. */
export type Bases = Record<string, Basis>;

/**
 * The ops of one intent kept unsent, whole, with the points each was made on: their analysis no longer holds them,
 * so they wait for the reviewer to apply them to `kept.guess` or discard them. `name` is the analysis they were on.
 */
export interface HeldOp {
    ops: Op[];
    basis: Bases;
    name: string;
    kept: Kept;
}

export const KEPT_ACTION = 'the analysis was replaced before it could be sent';

/** The pending ops cut into groups: the ops of one emitBatch together, any other op alone. */
export function groupsOf(pending: Op[], groupOf: Record<string, string>): Op[][] {
    const groups: Op[][] = [];
    let previous: string | undefined;
    for (const op of pending) {
        const group = groupOf[op.client_op_id] ?? op.client_op_id;
        const last = groups.at(-1);
        if (last && group === previous) last.push(op);
        else groups.push([op]);
        previous = group;
    }
    return groups;
}

/** The analysis an op made on its analysis's points acts on: a split's, by their indices, an edit_points's or a merge's. */
function madeOnPoints(op: Op): string | undefined {
    if (!isCoordinate(op)) return undefined;
    return op.action === 'split' || op.action === 'edit_points' || op.action === 'merge'
        ? analysisKeyOf(op)
        : undefined;
}

/** Whether `op` judges, notes or relabels its analysis whole, which every part of a split of it inherits. */
const isWholeAnalysis = (op: Op) =>
    analysisKeyOf(op) !== undefined &&
    (op.type === 'verdict' || op.type === 'note' || (isCoordinate(op) && op.action === 'relabel'));

/** Whether `op` is an edit_points of the points alone, as a collected edit or a move sends. */
export const isPointsOnly = (op: Op): op is Op & { payload: { points: CoordinatePoint[] } } =>
    isEditPoints(op) && Object.keys(op.payload).every((field) => field === 'points');

/** The basis each of `ops` made on points has, applied over `analyses` after `pending`. */
export function basisOf(analyses: CoordinateAnalysis[], pending: Op[], ops: Op[], collected: boolean): Bases {
    const bases: Bases = {};
    const before = [...pending];
    for (const op of ops) {
        const key = madeOnPoints(op);
        if (key)
            bases[op.client_op_id] = {
                points: pointsAfter(analyses, before, key) ?? [],
                ...(collected && { collected: true }),
            };
        before.push(op);
    }
    return bases;
}

/** The index in `points` of each of `basis`, each point matched once; undefined when one is not there. */
function matched(basis: CoordinatePoint[], points: CoordinatePoint[]): number[] | undefined {
    const taken = new Set<number>();
    const at: number[] = [];
    for (const point of basis) {
        const index = points.findIndex((candidate, i) => !taken.has(i) && samePoints(candidate, point));
        if (index === -1) return undefined;
        taken.add(index);
        at.push(index);
    }
    return at;
}

/**
 * `op`, made on `basis`, as made on the analysis `key` holding `points`: its point indices taken to where `points`
 * holds each basis point, the points it does not name left as they are (in a split, with the last part). Undefined
 * when `points` does not hold every basis point.
 */
export function remapOnto(op: Op, basis: CoordinatePoint[], key: string, points: CoordinatePoint[]): Op | undefined {
    const at = matched(basis, points);
    if (!at) return undefined;
    const from = analysisKeyOf(op);
    const aimed = aimedAt(op, (named) => (named === from ? key : named));
    if (!isCoordinate(aimed) || samePoints(basis, points)) return aimed;
    const others = points.flatMap((_, i) => (at.includes(i) ? [] : [i]));
    if (isEditPoints(aimed)) {
        const place = at.length ? Math.min(...at) : points.length;
        const before = others.filter((i) => i < place).map((i) => points[i]);
        const after = others.filter((i) => i > place).map((i) => points[i]);
        return {
            ...aimed,
            payload: { ...aimed.payload, points: [...before, ...aimed.payload.points, ...after] },
        } as Op;
    }
    if (aimed.action === 'split') {
        const { parts } = aimed.payload as { parts: { indices: number[] }[] };
        const remapped = parts.map((part, n) => ({
            ...part,
            indices: [...part.indices.map((i) => at[i]), ...(n === parts.length - 1 ? others : [])],
        }));
        return { ...aimed, payload: { ...aimed.payload, parts: remapped } } as Op;
    }
    return aimed;
}

/** The ops of `group` placed where `follower` put their analyses, with the bases they now have; undefined to hold it. */
function placeGroup(group: Op[], bases: Bases, follower: Follower, before: Op[]) {
    const to = (key: string) => (follower.present.has(key) ? key : (follower.successor(key) ?? key));
    const placed: Op[] = [];
    const basis: Bases = {};
    for (const op of group) {
        const key = analysisKeyOf(op);
        if (key === undefined) {
            placed.push(op);
            continue;
        }
        const targets = follower.present.has(key) ? follower.now.filter((a) => a.key === key) : follower.follow(key);
        const made = bases[op.client_op_id];
        if (!made) {
            if (isWholeAnalysis(op) && targets.length > 1)
                placed.push(
                    ...targets.map((target, i) => ({
                        ...aimedAt(op, () => target.key),
                        client_op_id: i === 0 ? op.client_op_id : randomUUID(),
                    }))
                );
            else placed.push(aimedAt(op, to));
            continue;
        }
        const merged = keysNamed(op).slice(1);
        if (merged.some((other) => !follower.present.has(other) && follower.follow(other).length !== 1))
            return undefined;
        const landed = targets.flatMap((target) => {
            const points = pointsAfter(follower.now, [...before, ...placed], target.key) ?? [];
            const remapped = remapOnto(op, made.points, target.key, points);
            return remapped
                ? [{ op: aimedAt(remapped, (named) => (named === target.key ? named : to(named))), points }]
                : [];
        });
        if (!landed.length) return undefined;
        placed.push(landed[0].op);
        basis[landed[0].op.client_op_id] = { ...made, points: landed[0].points };
    }
    return { ops: placed, basis };
}

const nameIn = (analyses: CoordinateAnalysis[], key: string) => analyses.find((a) => a.key === key)?.name ?? key;

/** The first analysis the ops of `group` name. */
const firstKey = (group: Op[]) => group.map(analysisKeyOf).find((key) => key !== undefined) ?? '';

/** `group` held whole, with its ops' bases, on the analysis its first op names. */
function heldGroup(group: Op[], bases: Bases, name: string, kept: Kept): HeldOp {
    const basis = Object.fromEntries(
        group.flatMap((op) => (bases[op.client_op_id] ? [[op.client_op_id, bases[op.client_op_id]]] : []))
    );
    return { ops: group, basis, name, kept };
}

/** A collected edit kept unsent as the edit_points it would have sent, made on its base. */
export function heldEdit(edit: PointEdit, kept: Kept): HeldOp {
    const op = {
        client_op_id: randomUUID(),
        type: 'coordinate',
        target: { kind: 'coordinate_analysis', analysis_key: edit.key },
        action: 'edit_points',
        payload: { points: edit.points },
    } as Op;
    return { ops: [op], basis: { [op.client_op_id]: { points: edit.base } }, name: edit.name, kept };
}

/**
 * The pending ops once the follower's analyses replace the ones they were made on, a group at a time: each op
 * re-aimed by the follow rule; one that judges, notes or relabels an analysis a split replaced, copied onto every
 * part; one made on points placed on the analysis now holding every one of them, its indices remapped. A group
 * with an op that cannot be placed is held whole.
 */
export function followQueued(follower: Follower, pending: Op[], groupOf: Record<string, string>, bases: Bases) {
    const kept: Op[] = [];
    const groups: Record<string, string> = {};
    const basis: Bases = {};
    const held: HeldOp[] = [];
    for (const group of groupsOf(pending, groupOf)) {
        const placed = placeGroup(group, bases, follower, kept);
        if (!placed) {
            const key = firstKey(group);
            held.push(
                heldGroup(group, bases, nameIn(follower.was, key), {
                    message: KEPT_ACTION,
                    guess: guessFor(follower, key),
                })
            );
            continue;
        }
        kept.push(...placed.ops);
        Object.assign(basis, placed.basis);
        if (placed.ops.length > 1) for (const op of placed.ops) groups[op.client_op_id] = placed.ops[0].client_op_id;
    }
    return { pending: kept, groupOf: groups, basis, held };
}

/**
 * The pending ops once a refusal has dropped some, a group at a time: a group whose ops were made on points their
 * analysis no longer holds is pulled, whole. One that sent collected edits gives them back as collected edits;
 * any other is held, on the analysis as it is, with the message of the refusal on that analysis.
 */
export function pullStaleWork(
    pending: Op[],
    groupOf: Record<string, string>,
    bases: Bases,
    analyses: CoordinateAnalysis[],
    messageOf: (key: string) => string
) {
    const kept: Op[] = [];
    const edits: PointEdit[] = [];
    const held: HeldOp[] = [];
    for (const group of groupsOf(pending, groupOf)) {
        const stale = group.some((op, i) => {
            const made = bases[op.client_op_id];
            const key = analysisKeyOf(op);
            return (
                made &&
                key &&
                !samePoints(pointsAfter(analyses, [...kept, ...group.slice(0, i)], key) ?? [], made.points)
            );
        });
        if (!stale) kept.push(...group);
        else if (group.every((op) => bases[op.client_op_id]?.collected && isPointsOnly(op)))
            edits.push(
                ...group.filter(isPointsOnly).map((op) => {
                    const key = analysisKeyOf(op)!;
                    return {
                        key,
                        name: nameIn(analyses, key),
                        base: bases[op.client_op_id].points,
                        points: op.payload.points,
                    };
                })
            );
        else {
            const key = firstKey(group);
            held.push(heldGroup(group, bases, nameIn(analyses, key), { message: messageOf(key), guess: key }));
        }
    }
    return { kept, edits, held };
}

/**
 * The ops of `held` as made on the analysis `to` and on those of its other analyses still there, after `pending`;
 * or why they cannot be: the points one was made on are not all there.
 */
export function heldOnto(
    held: HeldOp,
    to: string,
    analyses: CoordinateAnalysis[],
    pending: Op[]
): { ops: Op[] } | { reason: string } {
    const present = new Set(analyses.map((a) => a.key));
    const ops: Op[] = [];
    for (const op of held.ops) {
        const key = analysisKeyOf(op);
        if (key === undefined) {
            ops.push(op);
            continue;
        }
        const into = present.has(key) ? key : to;
        const made = held.basis[op.client_op_id];
        if (
            keysNamed(op)
                .slice(1)
                .some((other) => !present.has(other))
        )
            return { reason: 'an analysis it merges is no longer there' };
        if (!made) {
            ops.push(aimedAt(op, (named) => (named === key ? into : named)));
            continue;
        }
        const remapped = remapOnto(op, made.points, into, pointsAfter(analyses, [...pending, ...ops], into) ?? []);
        if (!remapped) return { reason: `the points it was made on are no longer in ${nameIn(analyses, into)}` };
        ops.push(remapped);
    }
    return { ops };
}

/** What a held op does, in the reviewer's terms, with the analysis it was on. */
export function heldPhrase({ ops, name }: HeldOp): string {
    const actions = ops.filter(isCoordinate).map((op) => op.action);
    if (actions.includes('split')) return `split of ${name}`;
    if (actions.includes('merge')) return `merge into ${name}`;
    if (ops.every(isPointsOnly)) {
        const keys = new Set(ops.map(analysisKeyOf));
        return keys.size > 1 ? `move from ${name}` : `point edits on ${name}`;
    }
    return `edit of ${name}`;
}

/** The id a held op is known by: its first op's. */
export const heldId = (held: HeldOp) => held.ops[0].client_op_id;
