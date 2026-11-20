import type { DraftDetail, DraftEvent } from './types';

const standing = (event: DraftEvent) => !event.data?.undone_at;

/** Whether the draft has a "mark as sent" that has not been undone. */
export const sentHere = (draft: DraftDetail) => draft.events.some((event) => event.kind === 'sent' && standing(event));

/** Whether the last "mark as sent" can still be taken back: not once the author has used
 * the link since, which shows the email went out. The server refuses it then too. */
export function canUndoSent(draft: DraftDetail): boolean {
    let last = -1;
    draft.events.forEach((event, index) => {
        if (event.kind === 'sent' && standing(event)) last = index;
    });
    return last >= 0 && !draft.events.slice(last + 1).some((event) => event.actor === 'author' && standing(event));
}
