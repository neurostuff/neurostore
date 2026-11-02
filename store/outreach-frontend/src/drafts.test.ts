import { canUndoSent, sentHere } from './drafts';
import type { DraftDetail, DraftEvent } from './types';

const event = (kind: string, actor: DraftEvent['actor'] = 'admin', data: DraftEvent['data'] = null): DraftEvent => ({
    kind,
    actor,
    actor_id: null,
    data,
    created_at: '2026-11-01T00:00:00Z',
});
const draft = (...events: DraftEvent[]) => ({ events }) as unknown as DraftDetail;

test('a send can be undone until the author uses the link', () => {
    expect(canUndoSent(draft(event('checked'), event('sent')))).toBe(true);
    expect(canUndoSent(draft(event('sent'), event('opened', 'author')))).toBe(false);
    expect(canUndoSent(draft(event('sent'), event('submitted', 'author')))).toBe(false);
});

test('a reminder marked sent by mistake after the author started can be undone', () => {
    expect(canUndoSent(draft(event('sent'), event('opened', 'author'), event('sent')))).toBe(true);
});

test('an undone send is no send', () => {
    const undone = event('sent', 'admin', { undone_at: '2026-11-01T01:00:00Z' });
    expect(sentHere(draft(undone))).toBe(false);
    expect(canUndoSent(draft(undone))).toBe(false);
});
