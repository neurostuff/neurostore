import type { DraftDetail } from './types';

/** Whether the draft has a "mark as sent" that has not been undone. */
export const sentHere = (draft: DraftDetail) =>
    draft.events.some((event) => event.kind === 'sent' && !event.data?.undone_at);
