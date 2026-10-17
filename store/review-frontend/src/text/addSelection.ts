import type { ReviewStores } from '../store/reviewStores';
import type { EvidenceMode } from '../store/sessionStore';

/** Adds the selection to the evidence of the slot `key`, and puts the evidence cursor on it. */
export function addSelectionTo({ session, view }: ReviewStores, key: string, mode: EvidenceMode) {
    const { selection } = view.getState();
    if (!selection || !session.getState().addEvidence(key, selection, mode)) return false;
    view.getState().showSpan(selection);
    window.getSelection()?.removeAllRanges();
    view.getState().setSelection(null);
    return true;
}

/** Adds the selection to the focused slot's evidence, and puts the evidence cursor on it. */
export const addSelection = (stores: ReviewStores, mode: EvidenceMode) =>
    void addSelectionTo(stores, stores.view.getState().focus.key, mode);
