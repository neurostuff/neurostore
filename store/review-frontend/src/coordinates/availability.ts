import type { RecordIndex, SlotNode } from '../model/record';
import { currentAnalyses, entitiesNaming, guidedOrder, type CoordinateAnalysis } from '../model/coordinates';
import { focusedAnalysis, guidedIndex } from '../model/coordinateFocus';
import type { Reason as ReasonOf } from '../review/reason';
import { slotKey } from '../model/targetKey';
import { canAddEvidence, selectShownPoints, type SessionState } from '../store/sessionStore';
import type { ViewState } from '../store/viewStore';

export type CoordinateSession = Pick<SessionState, 'bundle' | 'pending' | 'collected'>;
export type CoordinateView = Pick<ViewState, 'coordinates' | 'merging'>;
type GuidedView = Pick<ViewState, 'coordinates' | 'showNonCoordinate'>;

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

/** Where the focused analysis is in the order Shift+J and Shift+K walk: its place from 1, 0 when it is not in it, of how many. */
export function guidedPosition(session: Pick<SessionState, 'bundle'>, view: GuidedView) {
    const { order, at } = guidedIndex(session, view);
    return { at: at + 1, of: order.length };
}

/** Why Shift+J (1) or Shift+K (-1) cannot move from the focused analysis: it is the last, or the first. */
export const guidedEnd =
    (delta: 1 | -1): ReasonOf<Pick<SessionState, 'bundle'>, GuidedView> =>
    (session, view) => {
        const { at, of } = guidedPosition(session, view);
        if (at === 0) return undefined;
        if (delta > 0 && at === of) return 'This is the last analysis';
        if (delta < 0 && at === 1) return 'This is the first analysis';
        return undefined;
    };

/** The record slot holding an entity's editable name: the one a rename sets, whatever other slots can name it. */
export const NAME_SLOT = 'name';

/** The name slot of the record entity naming `analysis` that takes evidence, if one does. */
export function namingSlot(index: RecordIndex, analysis: CoordinateAnalysis): SlotNode | undefined {
    return entitiesNaming(index, analysis.key)
        .map((entity) => index.slot(slotKey(entity.id, NAME_SLOT)))
        .find(canAddEvidence);
}

type Reason = ReasonOf<CoordinateSession, CoordinateView>;

const NO_ANALYSIS = 'Focus an analysis first';

const pointCount = (session: CoordinateSession, view: CoordinateView) => {
    const analysis = focusedAnalysis({ bundle: session.bundle, coordinates: view.coordinates });
    return analysis ? selectShownPoints(session, analysis.key).length : 0;
};

/** Why an action cannot act on the focused analysis now, after `more` says what else it needs; undefined when it can. */
const needs =
    (more: Reason = () => undefined): Reason =>
    (session, view) =>
        focusedAnalysis({ bundle: session.bundle, coordinates: view.coordinates }) ? more(session, view) : NO_ANALYSIS;

/** Why each coordinate action does not apply to the focus, by action; the toolbar, the keys and the panels read it. */
export const COORDINATE_UNAVAILABLE = {
    judge: needs(),
    note: needs(),
    editPoint: needs((session, view) =>
        pointCount(session, view) ? undefined : 'This analysis has no points yet: add a row in its grid'
    ),
    move: needs((session, view) => {
        if (!movingPoints(view).length) return 'Focus a point, or select points: drag over rows or press Space';
        return moveTargets(session, view).length ? undefined : 'There is no other analysis to move points to';
    }),
    split: needs((session, view) => {
        const selected = view.coordinates?.selected ?? [];
        if (!selected.length) return 'Select the points to split off: drag over rows or press Space';
        return selected.length < pointCount(session, view) ? undefined : 'Leave at least one point unselected to split';
    }),
    merge: needs((session, view) =>
        mergeSet(session, view).length < 2
            ? 'Merge joins whole analyses: Shift-click another analysis’s card; to put these points in another analysis, use Move to…'
            : undefined
    ),
    addAnalysis: needs((session, view) =>
        focusedAnalysis({ bundle: session.bundle, coordinates: view.coordinates })!.table_id
            ? undefined
            : 'A text analysis has no table: use Add an analysis below, from the selected text'
    ),
} satisfies Record<string, Reason>;
