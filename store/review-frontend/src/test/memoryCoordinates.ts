import type { Op } from '../contract/generated/review-ops';
import { originsOf, RECORD_LINK, type CoordinateAnalysis, type CoordinateParse } from '../model/coordinates';
import type { Json } from '../model/paths';
import type { InverseOp } from '../store/undoSteps';

type CoordinateOp = Extract<Op, { type: 'coordinate' }>;
type Indexed<T> = { index: number } & T;
type Entity = Json & { local_id: string };

/** A stand-in for study_schema's key rule: sixteen hex digits of FNV-1a over the name, space and points. */
export function fakeKey(analysis: Pick<CoordinateAnalysis, 'name' | 'coordinate_space' | 'points'>): string {
    const text = JSON.stringify([analysis.name, analysis.coordinate_space ?? null, analysis.points ?? []]);
    const halves = [0x811c9dc5, 0x01000193].map((seed) => {
        let hash = seed;
        for (const char of text) hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193) >>> 0;
        return hash.toString(16).padStart(8, '0');
    });
    return `analysis#${halves.join('')}`;
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

function editPoints(analyses: CoordinateAnalysis[], record: Json, op: CoordinateOp): CoordinateStep {
    const at = analyses.findIndex((a) => op.target.kind === 'coordinate_analysis' && a.key === op.target.analysis_key);
    if (at === -1) throw new Error('no such analysis in the revision');
    const before = analyses[at];
    const payload = op.payload as { points: CoordinateAnalysis['points']; name?: string; coordinate_space?: string };
    const changed = {
        ...before,
        points: payload.points,
        ...('name' in payload && { name: payload.name }),
        ...('coordinate_space' in payload && { coordinate_space: payload.coordinate_space }),
    };
    const after = { ...changed, key: fakeKey(changed), derived_from: originsOf(before) };
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

/** Applies a coordinate op as the server does, for edit_points and restore; throws the refusal otherwise. */
export function applyCoordinate(parse: CoordinateParse | null, record: Json, op: CoordinateOp): CoordinateStep {
    const analyses = parse?.analyses ?? [];
    if (op.action === 'edit_points') return editPoints(analyses, record, op);
    if (op.action === 'restore') return restore(analyses, record, op);
    throw new Error(`the memory backend applies no ${op.action}`);
}
