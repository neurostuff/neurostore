import {
    defaultFilters,
    matches,
    nextStep,
    paperRows,
    readFilters,
    sortRows,
    writeFilters,
    type Filters,
    type PaperRow,
} from './filters';
import type { Candidate, DraftSummary, PersonSummary } from './types';

const NOW = new Date('2026-10-30T12:00:00Z').getTime();
const daysAgo = (days: number) => new Date(NOW - days * 24 * 60 * 60 * 1000).toISOString();

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

const draft = (id: string, over: Partial<DraftSummary> = {}): DraftSummary => ({
    id,
    base_study_id: `bs-${id}`,
    name: `Paper ${id}`,
    year: 2026,
    doi: null,
    journal: 'NeuroImage',
    status: 'checked',
    created_at: daysAgo(10),
    last_activity_at: daysAgo(1),
    analyses: 2,
    person_id: `p-${id}`,
    person: person(`p-${id}`),
    ...over,
});

const candidate = (id: string, over: Partial<Candidate> = {}): Candidate => ({
    base_study_id: id,
    name: `Candidate ${id}`,
    year: 2026,
    doi: null,
    pmid: null,
    journal: 'Cerebral Cortex',
    result_analyses: 1,
    ...over,
});

const filters = (over: Partial<Filters> = {}): Filters => ({ ...defaultFilters(2026), ...over });
const ids = (rows: PaperRow[], f: Filters) => rows.filter((row) => matches(row, f, NOW)).map((row) => row.id);

test('one view holds candidates and drafts, filtered by phase', () => {
    const rows = paperRows(
        [candidate('c1')],
        [draft('d1', { status: 'draft' }), draft('d2', { status: 'contacted' }), draft('d3', { status: 'uploading' })]
    );
    expect(ids(rows, filters())).toEqual(['c1', 'd1', 'd2', 'd3']);
    expect(ids(rows, filters({ phases: ['not_started'] }))).toEqual(['c1']);
    expect(ids(rows, filters({ phases: ['emailed', 'uploading'] }))).toEqual(['d2', 'd3']);
});

test('ready to email holds back a second paper by the same person, whatever is filtered', () => {
    const ada = person('ada');
    const rows = paperRows(
        [],
        [
            draft('old', { year: 2025, person_id: 'ada', person: ada }),
            draft('new', { year: 2026, person_id: 'ada', person: ada }),
        ]
    );
    expect(ids(rows, filters({ ready: true }))).toEqual(['new']); // the newest paper goes
    expect(nextStep(rows.find((row) => row.id === 'old')!)).toBe(
        'Held: another paper of theirs is in this batch'
    );
    // Searching for the held paper alone does not make it ready.
    expect(ids(rows, filters({ ready: true, search: 'paper old' }))).toEqual([]);
});

test('idle, author and search filters', () => {
    const rows = paperRows(
        [candidate('c1')],
        [
            draft('stale', { status: 'opened', last_activity_at: daysAgo(20) }),
            draft('fresh', { status: 'opened', last_activity_at: daysAgo(2) }),
            draft('out', { person: person('p-out', { suppressed: true }) }),
            draft('mailed', { status: 'contacted', person: person('p-mailed', { messages: 1 }) }),
        ]
    );
    expect(ids(rows, filters({ idleDays: 14 }))).toEqual(['stale']); // candidates have no activity
    expect(ids(rows, filters({ suppressed: true }))).toEqual(['out']);
    expect(ids(rows, filters({ emailed: true }))).toEqual(['mailed']);
    expect(ids(rows, filters({ search: 'cerebral' }))).toEqual(['c1']);
});

test('oldest activity sorts drafts by when anything last happened', () => {
    const rows = paperRows(
        [],
        [draft('recent', { last_activity_at: daysAgo(1) }), draft('older', { last_activity_at: daysAgo(9) })]
    );
    expect(sortRows(rows, 'oldest_activity').map((row) => row.id)).toEqual(['older', 'recent']);
});

test('filters round-trip through the URL and ignore what they do not know', () => {
    const f = filters({ phases: ['emailed', 'uploading'], idleDays: 14, ready: false, emailed: true, search: 'reward' });
    expect(readFilters(writeFilters(f, 2026), 2026)).toEqual(f);
    expect(readFilters(new URLSearchParams('phase=bogus&idle=x&sort=sideways'), 2026)).toEqual(filters());
});
