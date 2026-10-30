import { batchBlockers } from './batch';
import type { DraftSummary, PersonSummary } from './types';

const person = (id: string, over: Partial<PersonSummary> = {}): PersonSummary => ({
    id,
    author_id: null,
    opted_out_at: null,
    bounced_at: null,
    suppressed: false,
    messages: 0,
    notes: null,
    ...over,
});

const draft = (id: string, who: PersonSummary | null, over: Partial<DraftSummary> = {}): DraftSummary => ({
    id,
    base_study_id: `bs-${id}`,
    name: `Paper ${id}`,
    year: 2026,
    doi: null,
    journal: null,
    status: 'checked',
    created_at: '2026-10-30T00:00:00Z',
    last_activity_at: '2026-10-30T00:00:00Z',
    analyses: 1,
    person_id: who?.id ?? null,
    person: who,
    ...over,
});

test('a person gets one email per batch: their first paper listed', () => {
    const ada = person('ada');
    const result = batchBlockers([draft('1', ada), draft('2', ada), draft('3', person('bob'))]);
    expect(result.get('1')).toEqual([]);
    expect(result.get('2')).toEqual(['another paper of theirs is in this batch']);
    expect(result.get('3')).toEqual([]);
});

test('unapproved drafts, missing addresses, opt-outs and earlier emails are held back', () => {
    const result = batchBlockers([
        draft('1', person('a'), { status: 'draft' }),
        draft('2', null),
        draft('3', person('c', { suppressed: true })),
        draft('4', person('d', { messages: 1 })),
    ]);
    expect(result.get('1')).toEqual(['not approved yet']);
    expect(result.get('2')).toEqual(['no address to write to']);
    expect(result.get('3')).toEqual(['opted out or bounced']);
    expect(result.get('4')).toEqual(['already emailed']);
});

test('a blocked draft does not use up its person in the batch', () => {
    const ada = person('ada');
    const result = batchBlockers([draft('1', ada, { status: 'draft' }), draft('2', ada)]);
    expect(result.get('2')).toEqual([]);
});
