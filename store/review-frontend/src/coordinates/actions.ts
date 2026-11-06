import type { CoordinateOp, EditPointsPayload, Op, SetValueOp } from '../contract/generated/review-ops';
import { acceptTarget, danglingLinks, setValue } from '../inspector/actions';
import type { RecordIndex, SlotNode, SpanPair } from '../model/record';
import {
    analysisNamedBy,
    currentAnalyses,
    entitiesNaming,
    type CoordinateAnalysis,
    type CoordinatePoint,
} from '../model/coordinates';
import { randomUUID } from '../model/uuid';
import { pendingFields } from '../store/pointEdits';
import { focusedAnalysis } from '../model/coordinateFocus';
import { analysisTarget, slotTarget, targetKey } from '../model/targetKey';
import type { ReviewStores } from '../store/reviewStores';
import { selectShownPoints, type SessionState } from '../store/sessionStore';
import { addSelectionTo } from '../text/addSelection';
import type { Panel, PanelKind } from '../store/viewStore';
import {
    COORDINATE_UNAVAILABLE,
    mergeSet,
    moveTargets,
    movingPoints,
    NAME_SLOT,
    namingSlot,
    type CoordinateSession,
    type CoordinateView,
} from './availability';

type NewOp = Omit<CoordinateOp, 'client_op_id' | 'type'>;

const coordinateOp = (op: NewOp) => ({ client_op_id: randomUUID(), type: 'coordinate', ...op }) as Op;
const send = ({ session }: ReviewStores, op: NewOp) => session.getState().emitBatch([coordinateOp(op)]);

/** The analysis `key` as the reviewer last left it: its points, and the fields its pending ops give. */
function shownAnalysis(session: CoordinateSession, key: string | undefined): CoordinateAnalysis | undefined {
    const analysis = currentAnalyses(session.bundle).find((candidate) => candidate.key === key);
    return (
        analysis && {
            ...analysis,
            ...pendingFields(session.pending, analysis.key),
            points: selectShownPoints(session, analysis.key),
        }
    );
}

/**
 * The analysis `key` as shown, having asked for the collected point edits to be sent now, so that what follows
 * queues behind them; undefined, asking nothing, when there is no such analysis.
 */
function shownAfterSending(stores: ReviewStores, key: string | undefined) {
    const analysis = shownAnalysis(stores.session.getState(), key);
    if (analysis) stores.session.getState().askToSend();
    return analysis;
}

/**
 * Emits the ops `build` makes from the focused analysis as it is shown, as one batch after the point edits collected;
 * false when there is none.
 */
function act(
    stores: ReviewStores,
    build: (analysis: CoordinateAnalysis, session: CoordinateSession, view: CoordinateView) => NewOp[] | undefined
) {
    const view = stores.view.getState();
    const analysis = shownAfterSending(stores, view.coordinates?.analysis);
    const ops = analysis && build(analysis, stores.session.getState(), view);
    if (!ops?.length) return false;
    return stores.session.getState().emitBatch(ops.map(coordinateOp));
}

const pointsOf = (analysis: CoordinateAnalysis): CoordinatePoint[] => analysis.points ?? [];

const editPoints = (analysis: CoordinateAnalysis, points: CoordinatePoint[]): NewOp => ({
    target: analysisTarget(analysis.key),
    action: 'edit_points',
    payload: { points },
});

/** Accepts the focused analysis with a verdict op, the one way to judge it; false when there is none. */
export function acceptAnalysis(stores: ReviewStores) {
    const analysis = shownAfterSending(stores, stores.view.getState().coordinates?.analysis);
    return analysis ? acceptTarget(stores, analysisTarget(analysis.key)) : false;
}

export const relabelAnalysis = (stores: ReviewStores, role: NonNullable<CoordinateOp['role']>) =>
    act(stores, (analysis) =>
        role === analysis.role ? undefined : [{ target: analysisTarget(analysis.key), action: 'relabel', role }]
    );

export interface AnalysisEdit {
    name: string;
    role: string;
    coordinate_space: string | null;
}

/** The set_value ops that give each record entity naming `analysis` the name `name`. */
function namingOps(index: RecordIndex, analysis: CoordinateAnalysis, name: string): Op[] {
    return entitiesNaming(index, analysis.key).flatMap((entity) => {
        const slot = entity.slots.find((candidate) => candidate.path === NAME_SLOT && candidate.kind === 'value');
        if (!slot || slot.value?.value === name) return [];
        const value = {
            extraction_status: 'extracted',
            value: name,
            value_source: slot.value?.value_source ?? 'reported',
        };
        return [
            {
                client_op_id: randomUUID(),
                type: 'set_value',
                target: slotTarget(entity.id, NAME_SLOT),
                value,
            } as SetValueOp,
        ];
    });
}

/**
 * The batch renaming `analysis` to `name` with each record entity naming it: their names' set_values, then the
 * analysis's edit_points, which carries `also` with the name. Every rename sends it, so the two names are one intent.
 */
export function renamePair(
    index: RecordIndex,
    analysis: CoordinateAnalysis,
    name: string,
    also: Pick<EditPointsPayload, 'coordinate_space'> = {}
): Op[] {
    return [
        ...namingOps(index, analysis, name),
        coordinateOp({
            target: analysisTarget(analysis.key),
            action: 'edit_points',
            payload: { points: pointsOf(analysis), name, ...also },
        }),
    ];
}

/**
 * The ops that give `analysis` the name, space and role of `edit`: the record names first, then a relabel for the
 * role, then edit_points for the name and space.
 */
function editOps(index: RecordIndex, analysis: CoordinateAnalysis, edit: AnalysisEdit): Op[] {
    const target = analysisTarget(analysis.key);
    const moved = edit.coordinate_space !== (analysis.coordinate_space ?? null);
    const space = moved ? { coordinate_space: edit.coordinate_space } : {};
    const relabel =
        edit.role !== analysis.role
            ? [coordinateOp({ target, action: 'relabel', role: edit.role as NonNullable<CoordinateOp['role']> })]
            : [];
    if (edit.name !== analysis.name) {
        const renamed = renamePair(index, analysis, edit.name, space);
        return [...renamed.slice(0, -1), ...relabel, ...renamed.slice(-1)];
    }
    const points = moved
        ? [coordinateOp({ target, action: 'edit_points', payload: { points: pointsOf(analysis), ...space } })]
        : [];
    return [...relabel, ...points];
}

/** Gives the analysis `key` the name, space and role of `edit` as one batch; true when nothing changes, false when it cannot be sent. */
export function editAnalysis(stores: ReviewStores, key: string, edit: AnalysisEdit) {
    const analysis = shownAfterSending(stores, key);
    if (!analysis) return false;
    const session = stores.session.getState();
    const ops = editOps(session.index, analysis, edit);
    return ops.length === 0 || session.emitBatch(ops);
}

/** Saves a slot's value; a new name of a record entity naming a coordinate analysis renames that analysis in the same batch. */
export function saveSlotValue(stores: ReviewStores, slot: SlotNode, value: SetValueOp['value']) {
    const session = stores.session.getState();
    const named =
        slot.path === NAME_SLOT && typeof value.value === 'string'
            ? analysisNamedBy(session.index.entity(slot.entity), currentAnalyses(session.bundle))
            : undefined;
    const analysis = shownAnalysis(session, named?.key);
    if (!analysis || analysis.name === value.value) return setValue(stores, slot, value);
    session.askToSend();
    const edited = slotTarget(slot.entity, slot.path);
    const ops = renamePair(session.index, analysis, value.value as string).map((op) =>
        op.type === 'set_value' && targetKey(op.target) === targetKey(edited) ? { ...op, value } : op
    );
    return stores.session.getState().emitBatch(ops);
}

/** Renames the analysis `key`, keeping its space and role. */
export function renameAnalysis(stores: ReviewStores, key: string, name: string) {
    const analysis = shownAnalysis(stores.session.getState(), key);
    if (!analysis) return false;
    return editAnalysis(stores, key, {
        name,
        role: analysis.role,
        coordinate_space: analysis.coordinate_space ?? null,
    });
}

/** Puts the keyboard in the point grid on the focused point's row, or the first row when no point is focused. */
export function editPoint(stores: ReviewStores) {
    const view = stores.view.getState();
    const session = stores.session.getState();
    const analysis = focusedAnalysis({ bundle: session.bundle, coordinates: view.coordinates });
    if (!analysis || !selectShownPoints(session, analysis.key).length) return false;
    view.focusAnalysis(analysis.key, view.coordinates?.point ?? 0);
    stores.view.getState().engageGrid();
    return true;
}

/** Removes the focused point, collected as an edit of the grid is. */
export function removePoint(stores: ReviewStores) {
    const session = stores.session.getState();
    const { coordinates } = stores.view.getState();
    const at = coordinates?.point;
    if (at === null || at === undefined || !coordinates) return false;
    const points = selectShownPoints(session, coordinates.analysis);
    return session.collect(
        coordinates.analysis,
        points.filter((_, i) => i !== at)
    );
}

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
            editPoints(destination, [...selectShownPoints(session, to), ...moving.map((i) => points[i])]),
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

export function mergeAnalyses(stores: ReviewStores) {
    const [into, ...others] = mergeSet(stores.session.getState(), stores.view.getState());
    if (!into || !others.length || !shownAfterSending(stores, into.key)) return false;
    return send(stores, {
        target: analysisTarget(into.key),
        action: 'merge',
        payload: { with: others.map((analysis) => analysis.key) as [string, ...string[]] },
    });
}

/** What a merge would remove from the record, as a preview: the other analyses' entities and the links into them. */
export function mergePreview(session: Pick<SessionState, 'bundle' | 'index'>, view: CoordinateView) {
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

/** Where a new analysis is read from: a table, or a span of the text. */
export type AnalysisSource = { table: string } | { span: SpanPair };

/**
 * Adds an analysis read from `source`, with `points`; the server computes its key. `record` gives
 * values for the record entity the add makes, set once the server has made it.
 */
export function addAnalysis(
    stores: ReviewStores,
    source: AnalysisSource,
    fields: NewAnalysis,
    points: CoordinatePoint[],
    record: Record<string, string> = {}
) {
    stores.session.getState().askToSend();
    const read =
        'table' in source
            ? { origin: 'table', table_id: source.table, cells: [] }
            : { origin: 'text', text_spans: [{ start_char: source.span[0], end_char: source.span[1] }] };
    const op = coordinateOp({
        target: { kind: 'coordinate_parse' },
        action: 'add',
        payload: { analysis: { ...read, ...fields, points } },
    });
    if (!stores.session.getState().emitBatch([op])) return false;
    if (Object.keys(record).length) stores.view.getState().setOnMade(op.client_op_id, record);
    return true;
}

/** The action of COORDINATE_UNAVAILABLE that says whether each panel opens on the focused analysis. */
const PANEL_ACTIONS: Partial<Record<PanelKind, keyof typeof COORDINATE_UNAVAILABLE>> = {
    note: 'note',
    edit_analysis: 'judge',
    relabel: 'judge',
    reject: 'judge',
    move: 'move',
    merge: 'merge',
    add_analysis: 'addAnalysis',
};

/** The panel that adds an analysis to a table. */
export const addAnalysisPanel = (table: string): Panel => ({ kind: 'add_analysis', target: { kind: 'paper' }, table });

/** The panel that adds an analysis read from a span of the text. */
export const textAnalysisPanel = (span: SpanPair): Panel => ({ kind: 'add_analysis', target: { kind: 'paper' }, span });

/** The panel `kind` opens on the focused coordinate analysis; undefined where it does not apply. */
export function coordinatePanelFor(
    session: CoordinateSession,
    view: CoordinateView,
    kind: PanelKind
): Panel | undefined {
    const action = PANEL_ACTIONS[kind];
    const analysis = focusedAnalysis({ bundle: session.bundle, coordinates: view.coordinates });
    if (!action || !analysis || COORDINATE_UNAVAILABLE[action](session, view)) return undefined;
    return kind === 'add_analysis'
        ? addAnalysisPanel(analysis.table_id!)
        : { kind, target: analysisTarget(analysis.key) };
}

/** Adds the selection to the evidence of the name of the record entity naming the focused analysis. */
export function addSelectionToAnalysis(stores: ReviewStores) {
    const session = stores.session.getState();
    const analysis = focusedAnalysis({ bundle: session.bundle, coordinates: stores.view.getState().coordinates });
    const slot = analysis && namingSlot(session.index, analysis);
    return slot ? addSelectionTo(stores, slot.key) : false;
}
