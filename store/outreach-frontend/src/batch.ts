import type { DraftSummary, PersonSummary } from './types';

/** One key per author: their ORCID/OpenAlex author when we know it, else their address. */
const authorKey = (person: PersonSummary) => person.author_id ?? `person:${person.id}`;

/** Why a draft should not go out in this batch; empty when it can. */
export function blockers(draft: DraftSummary): string[] {
    const reasons: string[] = [];
    if (draft.status === 'draft') reasons.push('not approved yet');
    if (!draft.person) reasons.push('no address to write to');
    else if (draft.person.suppressed) reasons.push('opted out or bounced');
    else if (draft.person.author_messages > 0)
        reasons.push(draft.person.messages > 0 ? 'already emailed' : 'already emailed at another address');
    return reasons;
}

/** Each draft's blockers, plus "another paper of theirs is in this batch" for every draft
 * of an author but the first one listed, so no one gets two emails, even at two addresses. */
export function batchBlockers(drafts: DraftSummary[]): Map<string, string[]> {
    const seen = new Set<string>();
    const result = new Map<string, string[]>();
    for (const draft of drafts) {
        const reasons = blockers(draft);
        if (draft.person && reasons.length === 0) {
            const key = authorKey(draft.person);
            if (seen.has(key)) reasons.push('another paper of theirs is in this batch');
            else seen.add(key);
        }
        result.set(draft.id, reasons);
    }
    return result;
}
