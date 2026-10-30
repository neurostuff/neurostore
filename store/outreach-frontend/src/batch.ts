import type { DraftSummary } from './types';

/** Why a draft should not go out in this batch; empty when it can. */
export function blockers(draft: DraftSummary): string[] {
    const reasons: string[] = [];
    if (draft.status === 'draft') reasons.push('not approved yet');
    if (!draft.person) reasons.push('no address to write to');
    else if (draft.person.suppressed) reasons.push('opted out or bounced');
    else if (draft.person.messages > 0) reasons.push('already emailed');
    return reasons;
}

/** Each draft's blockers, plus "another paper of theirs is in this batch" for every draft
 * of a person but the first one listed, so no one gets two emails. */
export function batchBlockers(drafts: DraftSummary[]): Map<string, string[]> {
    const seen = new Map<string, string>();
    const result = new Map<string, string[]>();
    for (const draft of drafts) {
        const reasons = blockers(draft);
        const personId = draft.person_id;
        if (personId && reasons.length === 0) {
            if (seen.has(personId)) reasons.push('another paper of theirs is in this batch');
            else seen.set(personId, draft.id);
        }
        result.set(draft.id, reasons);
    }
    return result;
}
