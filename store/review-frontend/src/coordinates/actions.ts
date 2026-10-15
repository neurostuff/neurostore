import type { CoordinateOp, CoordinateTarget, Op } from '../contract/generated/review-ops';
import { danglingLinks } from '../inspector/actions';
import {
    currentAnalyses,
    entitiesNaming,
    guidedOrder,
    type CoordinateAnalysis,
    type CoordinatePoint,
} from '../model/coordinates';
import { randomUUID } from '../model/uuid';
import type { Panel, PanelKind, ReviewState } from '../store/reviewStore';

type State = Pick<ReviewState, 'bundle' | 'coordinates' | 'merging' | 'pending'>;
type Emitting = State & Pick<ReviewState, 'emitBatch'>;
type NewOp = Omit<CoordinateOp, 'client_op_id' | 'type'>;

export const analysisTarget = (analysis_key: string): CoordinateTarget => ({
    kind: 'coordinate_analysis',
    analysis_key,
});

export const focusedAnalysis = (s: Pick<State, 'bundle' | 'coordinates'>) =>
    currentAnalyses(s.bundle).find((analysis) => analysis.key === s.coordinates?.analysis);

/** Whether a coordinate op waits for its result; until it lands no key the client holds can be trusted. */
export const coordinatePending = (s: Pick<State, 'pending'>) => s.pending.some((op) => op.type === 'coordinate');

/** The keys the pending coordinate ops change. */
export function pendingKeys(s: Pick<State, 'pending'>): Set<string> {
    return new Set(
        s.pending.flatMap((op) => {
            if (op.type !== 'coordinate') return [];
            const merged = op.payload && 'with' in op.payload ? op.payload.with : [];
            return op.target.kind === 'coordinate_analysis' ? [op.target.analysis_key, ...merged] : [];
        })
    );
}

const coordinateOp = (op: NewOp) => ({ client_op_id: randomUUID(), type: 'coordinate', ...op }) as Op;
const send = (s: Pick<ReviewState, 'emitBatch'>, op: NewOp) => s.emitBatch([coordinateOp(op)]);

/** Emits the ops `build` makes from the focused analysis, as one batch; false when there is none or a coordinate op is pending. */
function act(s: Emitting, build: (analysis: CoordinateAnalysis) => NewOp[] | undefined) {
    const analysis = focusedAnalysis(s);
    const ops = analysis && !coordinatePending(s) ? build(analysis) : undefined;
    if (!ops?.length) return false;
    return s.emitBatch(ops.map(coordinateOp));
}

const pointsOf = (analysis: CoordinateAnalysis): CoordinatePoint[] => analysis.points ?? [];

const editPoints = (analysis: CoordinateAnalysis, points: CoordinatePoint[]): NewOp => ({
    target: analysisTarget(analysis.key),
    action: 'edit_points',
    payload: { points },
});

export const acceptAnalysis = (s: Emitting) =>
    act(s, (analysis) => [{ target: analysisTarget(analysis.key), action: 'accept' }]);

export const relabelAnalysis = (s: Emitting, role: NonNullable<CoordinateOp['role']>) =>
    act(s, (analysis) =>
        role === analysis.role ? undefined : [{ target: analysisTarget(analysis.key), action: 'relabel', role }]
    );

export const omitAnalysis = (s: Emitting) =>
    act(s, (analysis) => [{ target: analysisTarget(analysis.key), action: 'omit' }]);

/** Saves `point` as the point at `index` of the focused analysis, or as a new last point when `index` is null. */
export const savePoint = (s: Emitting, index: number | null, point: CoordinatePoint) =>
    act(s, (analysis) => {
        const points = pointsOf(analysis);
        return [
            editPoints(analysis, index === null ? [...points, point] : points.map((p, i) => (i === index ? point : p))),
        ];
    });

export const removePoint = (s: Emitting) =>
    act(s, (analysis) => {
        const at = s.coordinates?.point;
        return at === null || at === undefined
            ? undefined
            : [
                  editPoints(
                      analysis,
                      pointsOf(analysis).filter((_, i) => i !== at)
                  ),
              ];
    });

/** The points a move takes: the selected ones, else the focused one. */
export function movingPoints(s: Pick<State, 'coordinates'>): number[] {
    const { coordinates } = s;
    if (!coordinates) return [];
    if (coordinates.selected.length) return coordinates.selected;
    return coordinates.point === null ? [] : [coordinates.point];
}

/** The analyses points can move to: every other one the revision holds. */
export const moveTargets = (s: Pick<State, 'bundle' | 'coordinates'>) =>
    currentAnalyses(s.bundle).filter((analysis) => analysis.key !== s.coordinates?.analysis);

/** Moves the moving points to the analysis `to`, as one batch of two edit_points. */
export const movePoints = (s: Emitting, to: string) =>
    act(s, (analysis) => {
        const moving = movingPoints(s);
        const destination = moveTargets(s).find((candidate) => candidate.key === to);
        if (!moving.length || !destination) return undefined;
        const points = pointsOf(analysis);
        return [
            editPoints(
                analysis,
                points.filter((_, i) => !moving.includes(i))
            ),
            editPoints(destination, [...pointsOf(destination), ...moving.map((i) => points[i])]),
        ];
    });

type Indices = [number, ...number[]];

/** Splits the focused analysis in two: the selected points, then the rest. */
export const splitAnalysis = (s: Emitting) =>
    act(s, (analysis) => {
        const selected = s.coordinates?.selected ?? [];
        const rest = pointsOf(analysis)
            .map((_, i) => i)
            .filter((i) => !selected.includes(i));
        if (!selected.length || !rest.length) return undefined;
        const parts: [{ indices: Indices }, { indices: Indices }] = [
            { indices: selected as Indices },
            { indices: rest as Indices },
        ];
        return [{ target: analysisTarget(analysis.key), action: 'split', payload: { parts } }];
    });

/** The analyses a merge joins: those selected and the focused one, in guided order; the first takes the others. */
export function mergeSet(s: Pick<State, 'bundle' | 'coordinates' | 'merging'>): CoordinateAnalysis[] {
    const chosen = new Set([...s.merging, ...(s.coordinates ? [s.coordinates.analysis] : [])]);
    return guidedOrder(currentAnalyses(s.bundle), true).filter((analysis) => chosen.has(analysis.key));
}

export function mergeAnalyses(s: Emitting) {
    const [into, ...others] = mergeSet(s);
    if (!into || !others.length || coordinatePending(s)) return false;
    return send(s, {
        target: analysisTarget(into.key),
        action: 'merge',
        payload: { with: others.map((analysis) => analysis.key) as [string, ...string[]] },
    });
}

/** What a merge would remove from the record, as a preview: the other analyses' entities and the links into them. */
export function mergePreview(s: Pick<ReviewState, 'bundle' | 'coordinates' | 'merging' | 'index'>) {
    const [, ...others] = mergeSet(s);
    const removed = others.flatMap((analysis) => entitiesNaming(s.index, analysis.key));
    const gone = new Set(removed.map((entity) => entity.id));
    const dangling = removed
        .flatMap((entity) => danglingLinks(s, entity.id))
        .filter((link) => !gone.has(link.entity.id));
    return { removed, dangling };
}

interface NewAnalysis {
    name: string;
    role: string;
    coordinate_space?: string;
}

/** Adds an analysis read from `table`, with its first point; the server computes its key. */
export function addAnalysis(
    s: Pick<State, 'pending'> & Pick<ReviewState, 'emitBatch'>,
    table: string,
    fields: NewAnalysis,
    point: CoordinatePoint
) {
    if (coordinatePending(s)) return false;
    return send(s, {
        target: { kind: 'coordinate_parse' },
        action: 'add',
        payload: { analysis: { origin: 'table', table_id: table, ...fields, cells: [], points: [point] } },
    });
}

const COORDINATE_ACTIONS = new Set<PanelKind>([
    'relabel',
    'omit',
    'edit_point',
    'add_point',
    'move',
    'merge',
    'add_analysis',
]);

/** The panel that adds an analysis to a table. */
export const addAnalysisPanel = (table: string): Panel => ({ kind: 'add_analysis', target: { kind: 'paper' }, table });

/** The panel `kind` opens on the focused coordinate analysis; undefined where it does not apply. */
export function coordinatePanelFor(
    s: Pick<ReviewState, 'bundle' | 'coordinates' | 'merging' | 'pending'>,
    kind: PanelKind
): Panel | undefined {
    const analysis = focusedAnalysis(s);
    if (!analysis || (COORDINATE_ACTIONS.has(kind) && coordinatePending(s))) return undefined;
    const target = analysisTarget(analysis.key);
    switch (kind) {
        case 'note':
        case 'relabel':
        case 'omit':
        case 'add_point':
            return { kind, target };
        case 'edit_point':
            return s.coordinates?.point === null ? undefined : { kind, target };
        case 'move':
            return movingPoints(s).length && moveTargets(s).length ? { kind, target } : undefined;
        case 'merge':
            return mergeSet(s).length > 1 ? { kind, target } : undefined;
        case 'add_analysis':
            return analysis.table_id ? addAnalysisPanel(analysis.table_id) : undefined;
        default:
            return undefined;
    }
}
