import type { ReviewBundle } from '../contract/generated/review-bundle';
import { reviewerName } from '../format/people';
import { useSession } from '../store/context';

/** The name of the reviewer who made the change `entry` records, or undefined when no one has. */
export function editorName(
    reviewers: ReviewBundle['reviewers'],
    entry: { user_id: string } | undefined
): string | undefined {
    return entry ? reviewerName(reviewers, entry.user_id) : undefined;
}

export function useEditorName(key: string): string | undefined {
    return useSession((s) => editorName(s.bundle.reviewers, s.provenance[key]));
}
