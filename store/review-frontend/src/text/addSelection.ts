import type { EvidenceMode, ReviewState } from '../store/reviewStore';

export function addSelection(state: ReviewState, mode: EvidenceMode) {
    if (state.selection && state.addEvidence(state.selection, mode)) {
        window.getSelection()?.removeAllRanges();
        state.setSelection(null);
    }
}
