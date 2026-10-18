import type { RecordIndex, SlotNode } from '../model/record';
import { currentAnalyses, entitiesNaming, guidedOrder, type CoordinateAnalysis } from '../model/coordinates';
import { focusedAnalysis } from '../model/coordinateFocus';
import type { Reason as ReasonOf } from '../review/reason';
import { slotKey } from '../model/targetKey';
import { canAddEvidence, type SessionState } from '../store/sessionStore';
import type { ViewState } from '../store/viewStore';

export type CoordinateSession = Pick<SessionState, 'bundle' | 'pending'>;
export type CoordinateView = Pick<ViewState, 'coordinates' | 'merging'>;

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

/** The analyses a merge joins: those selected and the focused one, in guided order; the first takes the others. */
export function mergeSet(
    { bundle }: Pick<SessionState, 'bundle'>,
    { coordinates, merging }: CoordinateView
): CoordinateAnalysis[] {
    const chosen = new Set([...merging, ...(coordinates ? [coordinates.analysis] : [])]);
    return guidedOrder(currentAnalyses(bundle), true).filter((analysis) => chosen.has(analysis.key));
}

/** The record slot holding an entity's editable name: the one a rename sets, whatever other slots can name it. */
export const NAME_SLOT = 'name';

/** The name slot of the record entity naming `analysis` that takes evidence, if one does. */
export function namingSlot(index: RecordIndex, analysis: CoordinateAnalysis): SlotNode | undefined {
    return entitiesNaming(index, analysis.key)
        .map((entity) => index.slot(slotKey(entity.id, NAME_SLOT)))
        .find(canAddEvidence);
}

type Reason = ReasonOf<CoordinateSession, CoordinateView>;

const PENDING = 'Wait for the coordinate change to save';
const NO_ANALYSIS = 'Focus an analysis first';

const pointCount = (session: CoordinateSession, view: CoordinateView) =>
    focusedAnalysis({ bundle: session.bundle, coordinates: view.coordinates })?.points?.length ?? 0;

/** Why an action cannot act on the focused analysis now, after `more` says what else it needs; undefined when it can. */
const needs =
    (more: Reason = () => undefined, waits = true): Reason =>
    (session, view) => {
        if (!focusedAnalysis({ bundle: session.bundle, coordinates: view.coordinates })) return NO_ANALYSIS;
        if (waits && coordinatePending(session)) return PENDING;
        return more(session, view);
    };

/** Why each coordinate action does not apply to the focus, by action; the toolbar, the keys and the panels read it. */
export const COORDINATE_UNAVAILABLE = {
    judge: needs(),
    note: needs(undefined, false),
    editPoint: needs((session, view) =>
        pointCount(session, view) ? undefined : 'This analysis has no points yet: add a row in its grid'
    ),
    move: needs((session, view) => {
        if (!movingPoints(view).length) return 'Focus a point, or select points with Space, first';
        return moveTargets(session, view).length ? undefined : 'There is no other analysis to move points to';
    }),
    split: needs((session, view) => {
        const selected = view.coordinates?.selected ?? [];
        if (!selected.length) return 'Select the points to split off with Space first';
        return selected.length < pointCount(session, view) ? undefined : 'Leave at least one point unselected to split';
    }),
    merge: needs((session, view) =>
        mergeSet(session, view).length > 1 ? undefined : 'Shift-click another analysis to merge with this one'
    ),
    addAnalysis: needs((session, view) =>
        focusedAnalysis({ bundle: session.bundle, coordinates: view.coordinates })!.table_id
            ? undefined
            : 'A text analysis has no table: use Add an analysis below, from the selected text'
    ),
} satisfies Record<string, Reason>;
