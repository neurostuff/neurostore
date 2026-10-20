import { createHash } from 'node:crypto';
import type { Op } from '../contract/generated/review-ops';
import { RECORD_LINK, type CoordinateAnalysis, type CoordinateParse } from '../model/coordinates';
import type { Json } from '../model/paths';
import type { InverseOp } from '../store/undoSteps';

type CoordinateOp = Extract<Op, { type: 'coordinate' }>;
type Indexed<T> = { index: number } & T;
type Entity = Json & { local_id: string };

const json = (value: unknown) => JSON.stringify(value);

/** `%.6g` as Python writes it: six significant digits, trailing zeros dropped, an exponent outside 1e-4 to 1e6. */
function sixDigits(value: number): string {
    const [mantissa, exponent] = (value + 0).toExponential(5).split('e');
    const power = Number(exponent);
    const trim = (digits: string) => (digits.includes('.') ? digits.replace(/\.?0+$/, '') : digits);
    if (power < -4 || power >= 6)
        return `${trim(mantissa)}e${power < 0 ? '-' : '+'}${String(Math.abs(power)).padStart(2, '0')}`;
    return trim((value + 0).toFixed(Math.max(5 - power, 0)));
}

/** study_schema's normalize_name: NFKC, case folded, every dash to '-', zero-width characters and whitespace dropped. */
const normalizeName = (name: string) =>
    name
        .normalize('NFKC')
        .toLowerCase()
        .replace(/[\p{Pd}\u2212]/gu, '-')
        .replace(/\u200b|\u200c|\u200d|\u2060|\ufeff/g, '')
        .replace(/\s+/g, '');

type KeyPoint = { coordinates: number[]; space?: string | null; values?: { kind: string; value: number }[] | null };

/** study_schema's key rule (keys.analysis_key): sha256 of the normalized name, the space and the sorted points. */
export function contentKey(analysis: Pick<CoordinateAnalysis, 'name' | 'coordinate_space' | 'points'>): string {
    const space = analysis.coordinate_space ?? '';
    const point = ({ coordinates, space: own, values }: KeyPoint) => [
        ...coordinates.map((c) => (Math.round(c * 100) / 100 + 0).toFixed(2)),
        own && own !== space ? own : '',
        (values ?? []).map((v) => [v.kind, sixDigits(v.value)]).sort((a, b) => (json(a) < json(b) ? -1 : 1)),
    ];
    const points = ((analysis.points ?? []) as KeyPoint[]).map(point).sort((a, b) => (json(a) < json(b) ? -1 : 1));
    const digest = createHash('sha256')
        .update(json([normalizeName(analysis.name), space, points]))
        .digest('hex');
    return `analysis#${digest.slice(0, 16)}`;
}

/** The original keys `analysis` comes from, as the core's sources gives them: none for one the reviewer added. */
const sourcesOf = (analysis: CoordinateAnalysis, originals: Set<string>) =>
    analysis.derived_from?.length ? analysis.derived_from : originals.has(analysis.key) ? [analysis.key] : [];

/** `analysis` with the key its content gives, and `sources` as derived_from unless they are just that key. */
function keyed(analysis: CoordinateAnalysis, sources: string[]): CoordinateAnalysis {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { derived_from, ...rest } = analysis;
    const key = contentKey(rest);
    const derived = sources.length && !(sources.length === 1 && sources[0] === key) ? { derived_from: sources } : {};
    return { ...rest, key, ...derived };
}

const recordAnalyses = (record: Json) => (record.analyses as Entity[] | undefined) ?? [];
const namedKey = (entity: Entity) => (entity[RECORD_LINK] as { value?: unknown } | undefined)?.value;

/** The revision and record after a coordinate op the memory backend applies, and the restore that undoes it. */
export interface CoordinateStep {
    analyses: CoordinateAnalysis[];
    record: Json;
    undo: InverseOp[];
}

function restoreOf(
    remove: Indexed<{ analysis: CoordinateAnalysis }>[],
    insert: Indexed<{ analysis: CoordinateAnalysis }>[],
    record: { remove: Indexed<{ entity: Entity }>[]; insert: Indexed<{ entity: Entity }>[] }
): InverseOp {
    return {
        type: 'coordinate',
        target: { kind: 'coordinate_parse' },
        action: 'restore',
        payload: { remove, insert, reasons: {}, record } as never,
    } as InverseOp;
}

function editPoints(
    analyses: CoordinateAnalysis[],
    record: Json,
    op: CoordinateOp,
    originals: Set<string>
): CoordinateStep {
    const at = analyses.findIndex((a) => op.target.kind === 'coordinate_analysis' && a.key === op.target.analysis_key);
    if (at === -1) throw new Error('no such analysis in the revision');
    const before = analyses[at];
    const payload = op.payload as { points: CoordinateAnalysis['points']; name?: string; coordinate_space?: string };
    const renamed = 'name' in payload && payload.name !== before.name;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { name_is_printed, ...unprinted } = before;
    const changed = {
        ...(renamed ? unprinted : before),
        points: payload.points,
        ...(renamed && { name: payload.name }),
        ...('coordinate_space' in payload && { coordinate_space: payload.coordinate_space }),
    } as CoordinateAnalysis;
    const after = keyed(changed, sourcesOf(before, originals));
    const entities = recordAnalyses(record);
    const repointed = entities.flatMap((entity, index) =>
        namedKey(entity) === before.key
            ? [
                  {
                      index,
                      before: entity,
                      after: { ...entity, [RECORD_LINK]: { ...(entity[RECORD_LINK] as Json), value: after.key } },
                  },
              ]
            : []
    );
    const nextEntities = entities.map((entity, i) => repointed.find((r) => r.index === i)?.after ?? entity);
    return {
        analyses: analyses.map((a, i) => (i === at ? after : a)),
        record: { ...record, analyses: nextEntities },
        undo: [
            restoreOf([{ index: at, analysis: after }], [{ index: at, analysis: before }], {
                remove: repointed.map(({ index, after: entity }) => ({ index, entity })),
                insert: repointed.map(({ index, before: entity }) => ({ index, entity })),
            }),
        ],
    };
}

/** Gives an analysis the op's role, keeping its key, which its role is no part of; the record is left as it is. */
function relabel(analyses: CoordinateAnalysis[], record: Json, op: CoordinateOp): CoordinateStep {
    const at = analyses.findIndex((a) => op.target.kind === 'coordinate_analysis' && a.key === op.target.analysis_key);
    if (at === -1) throw new Error('no such analysis in the revision');
    const before = analyses[at];
    const after = { ...before, role: op.role! };
    return {
        analyses: analyses.map((a, i) => (i === at ? after : a)),
        record,
        undo: [
            restoreOf([{ index: at, analysis: after }], [{ index: at, analysis: before }], { remove: [], insert: [] }),
        ],
    };
}

function restore(analyses: CoordinateAnalysis[], record: Json, op: CoordinateOp): CoordinateStep {
    const {
        remove,
        insert,
        record: entities,
    } = op.payload as unknown as {
        remove: Indexed<{ analysis: CoordinateAnalysis }>[];
        insert: Indexed<{ analysis: CoordinateAnalysis }>[];
        record: { remove: Indexed<{ entity: Entity }>[]; insert: Indexed<{ entity: Entity }>[] };
    };
    const changed = remove.some(({ analysis }) => {
        const held = analyses.find((a) => a.key === analysis.key);
        return JSON.stringify(held) !== JSON.stringify(analysis);
    });
    if (changed) throw new Error('an analysis this restore removes has changed since');
    const removed = new Set(remove.map(({ analysis }) => analysis.key));
    const kept = analyses.filter((a) => !removed.has(a.key));
    for (const { index, analysis } of [...insert].sort((a, b) => a.index - b.index)) kept.splice(index, 0, analysis);
    const gone = new Set(entities.remove.map(({ entity }) => entity.local_id));
    const keptEntities = recordAnalyses(record).filter((entity) => !gone.has(entity.local_id));
    for (const { index, entity } of [...entities.insert].sort((a, b) => a.index - b.index)) {
        keptEntities.splice(index, 0, entity);
    }
    const positions = (list: CoordinateAnalysis[], keys: string[]) =>
        keys.map((key) => ({
            index: list.findIndex((a) => a.key === key),
            analysis: list.find((a) => a.key === key)!,
        }));
    return {
        analyses: kept,
        record: { ...record, analyses: keptEntities },
        undo: [
            restoreOf(
                positions(
                    kept,
                    insert.map(({ analysis }) => analysis.key)
                ),
                remove,
                { remove: entities.insert, insert: entities.remove }
            ),
        ],
    };
}

/** Each of `analyses` that `others` does not hold, with its index, as the server logs an op's before and after. */
export const indexedAnalyses = (analyses: CoordinateAnalysis[], others: CoordinateAnalysis[]) =>
    analyses.flatMap((analysis, index) =>
        others.some((other) => JSON.stringify(other) === JSON.stringify(analysis)) ? [] : [{ index, analysis }]
    );

/** Splits an analysis into its parts, each named for its place and keyed for its points; the record is left as it is. */
function split(analyses: CoordinateAnalysis[], record: Json, op: CoordinateOp, originals: Set<string>): CoordinateStep {
    const at = analyses.findIndex((a) => op.target.kind === 'coordinate_analysis' && a.key === op.target.analysis_key);
    if (at === -1) throw new Error('no such analysis in the revision');
    const whole = analyses[at];
    const points = whole.points ?? [];
    const { parts } = op.payload as { parts: { indices: number[]; name?: string }[] };
    const indices = parts.flatMap((part) => part.indices).sort((a, b) => a - b);
    if (indices.join() !== points.map((_, i) => i).join())
        throw new Error('the split’s parts do not partition the points');
    const made = parts.map((part, n) => {
        const named = part.name
            ? { name: part.name }
            : { name: `${whole.name} (part ${n + 1})`, name_is_printed: false };
        return keyed({ ...whole, points: part.indices.map((i) => points[i]), ...named }, sourcesOf(whole, originals));
    });
    const next = [...analyses.slice(0, at), ...made, ...analyses.slice(at + 1)];
    return {
        analyses: next,
        record,
        undo: [
            restoreOf(
                made.map((analysis, i) => ({ index: at + i, analysis })),
                [{ index: at, analysis: whole }],
                { remove: [], insert: [] }
            ),
        ],
    };
}

const union = <T>(lists: T[][]) =>
    lists.flat().reduce<T[]>((out, item) => (out.some((held) => json(held) === json(item)) ? out : [...out, item]), []);

/** Merges the analyses `with` names into the target, in place of the target; the record is left as it is. */
function merge(
    analyses: CoordinateAnalysis[],
    record: Json,
    op: CoordinateOp,
    originals: Set<string>,
    order: string[]
): CoordinateStep {
    const at = analyses.findIndex((a) => op.target.kind === 'coordinate_analysis' && a.key === op.target.analysis_key);
    if (at === -1) throw new Error('no such analysis in the revision');
    const into = analyses[at];
    const keys = (op.payload as { with: string[] }).with;
    if (keys.includes(into.key)) throw new Error('an analysis cannot be merged with itself');
    const others = keys.map((key) => {
        const other = analyses.find((a) => a.key === key);
        if (!other) throw new Error('no such analysis in the revision');
        return other;
    });
    const all = [into, ...others];
    const merged = { ...into, points: all.flatMap((a) => a.points ?? []) } as CoordinateAnalysis;
    for (const field of ['cells', 'text_spans'] as const) {
        if (all.some((a) => (a[field] as unknown[] | undefined)?.length)) {
            merged[field] = union(all.map((a) => (a[field] as unknown[] | undefined) ?? [])) as never;
        }
    }
    const sources = [...new Set(all.flatMap((a) => sourcesOf(a, originals)))].sort(
        (a, b) => order.indexOf(a) - order.indexOf(b)
    );
    const made = keyed(merged, sources);
    const next = analyses.map((a, i) => (i === at ? made : a)).filter((a) => !others.includes(a));
    const positions = others.map((other) => ({ index: analyses.indexOf(other), analysis: other }));
    return {
        analyses: next,
        record,
        undo: [
            restoreOf([{ index: next.indexOf(made), analysis: made }], [{ index: at, analysis: into }, ...positions], {
                remove: [],
                insert: [],
            }),
        ],
    };
}

/**
 * Applies a coordinate op to the revision `current` of the original parse `parse` as the server does, for
 * edit_points, split, merge, relabel and restore; throws the refusal otherwise.
 */
export function applyCoordinate(
    current: CoordinateParse | null,
    record: Json,
    op: CoordinateOp,
    parse: CoordinateParse | null = current
): CoordinateStep {
    const analyses = current?.analyses ?? [];
    const order = (parse?.analyses ?? []).map((a) => a.key);
    const originals = new Set(order);
    if (op.action === 'edit_points') return editPoints(analyses, record, op, originals);
    if (op.action === 'split') return split(analyses, record, op, originals);
    if (op.action === 'merge') return merge(analyses, record, op, originals, order);
    if (op.action === 'restore') return restore(analyses, record, op);
    if (op.action === 'relabel') return relabel(analyses, record, op);
    throw new Error(`the memory backend applies no ${op.action}`);
}
