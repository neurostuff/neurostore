import type { CoordinateOp, Op } from '../contract/generated/review-ops';
import { acceptTarget, danglingLinks } from '../inspector/actions';
import {
    currentAnalyses,
    entitiesNaming,
    guidedOrder,
    type CoordinateAnalysis,
    type CoordinatePoint,
} from '../model/coordinates';
import { randomUUID } from '../model/uuid';
import { focusedAnalysis } from '../model/coordinateFocus';
import { analysisTarget } from '../model/targetKey';
import type { ReviewStores } from '../store/reviewStores';
import type { SessionState } from '../store/sessionStore';
import type { Panel, PanelKind, ViewState } from '../store/viewStore';

type Session = Pick<SessionState, 'bundle' | 'pending'>;
type View = Pick<ViewState, 'coordinates' | 'merging'>;
type NewOp = Omit<CoordinateOp, 'client_op_id' | 'type'>;

/** Whether a coordinate op waits for its result; until it lands no key the client holds can be trusted. */
export const coordinatePending = (s: Pick<SessionState, 'pending'>) => s.pending.some((op) => op.type === 'coordinate');

/** The keys the pending coordinate ops change. */
export function pendingKeys(s: Pick<SessionState, 'pending'>): Set<string> {
    return new Set(
        s.pending.flatMap((op) => {
            if (op.type !== 'coordinate') return [];
            const merged = op.payload && 'with' in op.payload ? op.payload.with : [];
            return op.target.kind === 'coordinate_analysis' ? [op.target.analysis_key, ...merged] : [];
        })
    );
}

const coordinateOp = (op: NewOp) => ({ client_op_id: randomUUID(), type: 'coordinate', ...op }) as Op;
const send = ({ session }: ReviewStores, op: NewOp) => session.getState().emitBatch([coordinateOp(op)]);

/** Emits the ops `build` makes from the focused analysis, as one batch; false when there is none or a coordinate op is pending. */
function act(
    stores: ReviewStores,
    build: (analysis: CoordinateAnalysis, session: Session, view: View) => NewOp[] | undefined
) {
    const session = stores.session.getState();
    const view = stores.view.getState();
    const analysis = focusedAnalysis({ bundle: session.bundle, coordinates: view.coordinates });
    const ops = analysis && !coordinatePending(session) ? build(analysis, session, view) : undefined;
    if (!ops?.length) return false;
    return session.emitBatch(ops.map(coordinateOp));
}

const pointsOf = (analysis: CoordinateAnalysis): CoordinatePoint[] => analysis.points ?? [];

const editPoints = (analysis: CoordinateAnalysis, points: CoordinatePoint[]): NewOp => ({
    target: analysisTarget(analysis.key),
    action: 'edit_points',
    payload: { points },
});

/** Accepts the focused analysis with a verdict op, the one way to judge it; false when there is none or a coordinate op is pending. */
export function acceptAnalysis(stores: ReviewStores) {
    const session = stores.session.getState();
    const analysis = focusedAnalysis({ bundle: session.bundle, coordinates: stores.view.getState().coordinates });
    if (!analysis || coordinatePending(session)) return false;
    return acceptTarget(stores, analysisTarget(analysis.key));
}

export const relabelAnalysis = (stores: ReviewStores, role: NonNullable<CoordinateOp['role']>) =>
    act(stores, (analysis) =>
        role === analysis.role ? undefined : [{ target: analysisTarget(analysis.key), action: 'relabel', role }]
    );

/** Saves `point` as the point at `index` of the focused analysis, or as a new last point when `index` is null. */
export const savePoint = (stores: ReviewStores, index: number | null, point: CoordinatePoint) =>
    act(stores, (analysis) => {
        const points = pointsOf(analysis);
        return [
            editPoints(analysis, index === null ? [...points, point] : points.map((p, i) => (i === index ? point : p))),
        ];
    });

export const removePoint = (stores: ReviewStores) =>
    act(stores, (analysis, _, view) => {
        const at = view.coordinates?.point;
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
export function movingPoints({ coordinates }: Pick<ViewState, 'coordinates'>): number[] {
    if (!coordinates) return [];
    if (coordinates.selected.length) return coordinates.selected;
    return coordinates.point === null ? [] : [coordinates.point];
}

/** The analyses points can move to: every other one the revision holds. */
export const moveTargets = (
    { bundle }: Pick<SessionState, 'bundle'>,
    { coordinates }: Pick<ViewState, 'coordinates'>
) => currentAnalyses(bundle).filter((analysis) => analysis.key !== coordinates?.analysis);

/** Moves the moving points to the analysis `to`, as one batch of two edit_points. */
export const movePoints = (stores: ReviewStores, to: string) =>
    act(stores, (analysis, session, view) => {
        const moving = movingPoints(view);
        const destination = moveTargets(session, view).find((candidate) => candidate.key === to);
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
export const splitAnalysis = (stores: ReviewStores) =>
    act(stores, (analysis, _, view) => {
        const selected = view.coordinates?.selected ?? [];
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
export function mergeSet(
    { bundle }: Pick<SessionState, 'bundle'>,
    { coordinates, merging }: View
): CoordinateAnalysis[] {
    const chosen = new Set([...merging, ...(coordinates ? [coordinates.analysis] : [])]);
    return guidedOrder(currentAnalyses(bundle), true).filter((analysis) => chosen.has(analysis.key));
}

export function mergeAnalyses(stores: ReviewStores) {
    const session = stores.session.getState();
    const [into, ...others] = mergeSet(session, stores.view.getState());
    if (!into || !others.length || coordinatePending(session)) return false;
    return send(stores, {
        target: analysisTarget(into.key),
        action: 'merge',
        payload: { with: others.map((analysis) => analysis.key) as [string, ...string[]] },
    });
}

/** What a merge would remove from the record, as a preview: the other analyses' entities and the links into them. */
export function mergePreview(session: Pick<SessionState, 'bundle' | 'index'>, view: View) {
    const [, ...others] = mergeSet(session, view);
    const removed = others.flatMap((analysis) => entitiesNaming(session.index, analysis.key));
    const gone = new Set(removed.map((entity) => entity.id));
    const dangling = removed
        .flatMap((entity) => danglingLinks(session, entity.id))
        .filter((link) => !gone.has(link.entity.id));
    return { removed, dangling };
}

interface NewAnalysis {
    name: string;
    role: string;
    coordinate_space?: string;
}

/** Adds an analysis read from `table`, with its first point; the server computes its key. */
export function addAnalysis(stores: ReviewStores, table: string, fields: NewAnalysis, point: CoordinatePoint) {
    if (coordinatePending(stores.session.getState())) return false;
    return send(stores, {
        target: { kind: 'coordinate_parse' },
        action: 'add',
        payload: { analysis: { origin: 'table', table_id: table, ...fields, cells: [], points: [point] } },
    });
}

const COORDINATE_ACTIONS = new Set<PanelKind>([
    'relabel',
    'reject',
    'edit_point',
    'add_point',
    'move',
    'merge',
    'add_analysis',
]);

/** The panel that adds an analysis to a table. */
export const addAnalysisPanel = (table: string): Panel => ({ kind: 'add_analysis', target: { kind: 'paper' }, table });

/** The panel `kind` opens on the focused coordinate analysis; undefined where it does not apply. */
export function coordinatePanelFor(session: Session, view: View, kind: PanelKind): Panel | undefined {
    const analysis = focusedAnalysis({ bundle: session.bundle, coordinates: view.coordinates });
    if (!analysis || (COORDINATE_ACTIONS.has(kind) && coordinatePending(session))) return undefined;
    const target = analysisTarget(analysis.key);
    switch (kind) {
        case 'note':
        case 'relabel':
        case 'reject':
        case 'add_point':
            return { kind, target };
        case 'edit_point':
            return view.coordinates?.point === null ? undefined : { kind, target };
        case 'move':
            return movingPoints(view).length && moveTargets(session, view).length ? { kind, target } : undefined;
        case 'merge':
            return mergeSet(session, view).length > 1 ? { kind, target } : undefined;
        case 'add_analysis':
            return analysis.table_id ? addAnalysisPanel(analysis.table_id) : undefined;
        default:
            return undefined;
    }
}
