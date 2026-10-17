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
