import type { SessionState } from '../store/sessionStore';
import type { ReviewStores } from '../store/reviewStores';
import { selectEvidenceCursor, selectFocusedSpans, selectShown } from '../store/viewSelectors';

/** The spans the focus highlights now. */
export const focusedSpans = ({ session, view }: ReviewStores) =>
    selectFocusedSpans(session.getState(), view.getState());

/** The evidence span the cursor is on now, within the focused spans. */
export const evidenceCursor = ({ session, view }: ReviewStores) =>
    selectEvidenceCursor(session.getState(), view.getState());

/** The index as the view lists it now. */
export const shownIndex = ({ session, view }: ReviewStores) => selectShown(session.getState(), view.getState());

/** The set index that adds a span to the slot `key` as a set of its own: one past its last set. */
export const newSet = ({ index }: Pick<SessionState, 'index'>, key: string) =>
    index.slot(key)?.value?.evidence?.sets?.length ?? 0;
