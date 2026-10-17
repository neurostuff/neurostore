import type { SpanPair } from '../model/record';
import type { ReviewStores } from '../store/reviewStores';
import { selectCursorSpan } from '../store/viewSelectors';
import { stepEdge, type Edge } from './snap';

const cursorSpan = ({ session, view }: ReviewStores) => {
    const span = selectCursorSpan(session.getState(), view.getState());
    return span && { slot: view.getState().focus.key, span };
};

/** Moves the span the evidence cursor is on to `to`, keeping the cursor on it. */
export function moveCursorSpan(stores: ReviewStores, to: SpanPair) {
    const at = cursorSpan(stores);
    if (!at || (at.span[0] === to[0] && at.span[1] === to[1])) return;
    if (stores.session.getState().moveEvidence(at.slot, at.span, to)) stores.view.getState().showSpan(to);
}

/** Moves one end of the span the evidence cursor is on a word left or right. */
export function stepCursorSpan(stores: ReviewStores, edge: Edge, delta: 1 | -1) {
    const at = cursorSpan(stores);
    if (at) moveCursorSpan(stores, stepEdge(stores.session.getState().bundle.text, at.span, edge, delta));
}

/** Removes `span`, by default the one the evidence cursor is on, from the focused slot's evidence. */
export function removeCursorSpan(stores: ReviewStores, span = cursorSpan(stores)?.span) {
    if (span) stores.session.getState().removeEvidence(stores.view.getState().focus.key, span);
}
