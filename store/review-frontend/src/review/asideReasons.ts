import type { SetAside } from '../api/reviewApi';

/** The reasons a paper is set aside, with their labels. */
export const SET_ASIDE_REASONS: Record<SetAside['reason'], string> = {
    no_usable_text: 'no usable text',
    out_of_scope: 'not a study in scope',
    no_results: 'no results to extract',
    duplicate: 'duplicate of another paper',
    other: 'other',
};
