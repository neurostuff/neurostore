import type { ReviewStores } from '../store/reviewStores';
import type { EvidenceMode } from '../store/sessionStore';

/** Adds the selection to the focused slot's evidence, and puts the evidence cursor on it. */
export function addSelection({ session, view }: ReviewStores, mode: EvidenceMode) {
    const { selection, focus } = view.getState();
    if (selection && session.getState().addEvidence(focus.key, selection, mode)) {
        view.getState().showSpan(selection);
        window.getSelection()?.removeAllRanges();
        view.getState().setSelection(null);
    }
}
