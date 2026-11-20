import { setHolding } from '../store/keptOps';
import type { ReviewStores } from '../store/reviewStores';
import { selectCursorSpan } from '../store/viewSelectors';

/** The evidence set of the slot `key` a span is added to: the one holding the evidence cursor's span, else the first. */
function targetSet({ session, view }: ReviewStores, key: string): number {
    const documents = session.getState();
    const focused = view.getState();
    const cursor = focused.focus.key === key ? selectCursorSpan(documents, focused) : null;
    if (!cursor) return 0;
    const evidence = documents.index.slot(key)?.value?.evidence;
    return Math.max(setHolding(evidence, { start_char: cursor[0], end_char: cursor[1] }), 0);
}

/** Adds the selection to the evidence of the slot `key`, and puts the evidence cursor on it. */
export function addSelectionTo(stores: ReviewStores, key: string) {
    const { session, view } = stores;
    const { selection } = view.getState();
    if (!selection || !session.getState().addEvidence(key, selection, targetSet(stores, key))) return false;
    view.getState().showSpan(selection);
    window.getSelection()?.removeAllRanges();
    view.getState().setSelection(null);
    return true;
}

/** Adds the selection to the focused slot's evidence, and puts the evidence cursor on it. */
export const addSelection = (stores: ReviewStores) => void addSelectionTo(stores, stores.view.getState().focus.key);
