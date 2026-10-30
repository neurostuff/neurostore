import { batchBlockers } from './batch';
import type { Candidate, DraftStatus, DraftSummary, PersonSummary } from './types';

/** A paper's place in outreach: no draft yet, or its draft's status. */
export type Stage = 'not_started' | DraftStatus;

/** One paper in the single view: a candidate with no draft yet, or a draft. */
export interface PaperRow {
    /** The draft's id, or the base study's for a candidate. */
    id: string;
    baseStudyId: string;
    draftId: string | null;
    name: string | null;
    journal: string | null;
    year: number | null;
    doi: string | null;
    pmid: string | null;
    pmcid: string | null;
    stage: Stage;
    analyses: number;
    person: PersonSummary | null;
    personId: string | null;
    createdAt: string | null;
    lastActivityAt: string | null;
    /** Why it cannot be emailed now; only for approved drafts. */
    held: string[];
}

export const PHASES = [
    { key: 'not_started', label: 'Not started', stages: ['not_started'] },
    { key: 'drafting', label: 'Draft', stages: ['draft', 'checked'] },
    { key: 'emailed', label: 'Emailed', stages: ['contacted', 'opened'] },
    { key: 'uploading', label: 'Upload in progress', stages: ['uploading'] },
    { key: 'completed', label: 'Upload completed', stages: ['submitted', 'approved', 'published'] },
    { key: 'closed', label: 'Closed', stages: ['declined', 'rejected', 'failed', 'files_deleted'] },
] as const satisfies readonly { key: string; label: string; stages: readonly Stage[] }[];
export type Phase = (typeof PHASES)[number]['key'];

export const phaseOf = (stage: Stage): Phase =>
    PHASES.find((phase) => (phase.stages as readonly Stage[]).includes(stage))!.key;

export type Sort = 'newest_paper' | 'oldest_activity';

export interface Filters {
    /** Empty means every phase. */
    phases: Phase[];
    /** Only approved drafts that can be emailed now. */
    ready: boolean;
    /** Only papers whose last activity is at least this many days old. */
    idleDays: number | null;
    /** Only papers whose author opted out or bounced (true), or did not (false). */
    suppressed: boolean | null;
    /** Only papers whose author has (true) or has not (false) been emailed about any paper. */
    emailed: boolean | null;
    /** Words to find in the title or journal. */
    search: string;
    /** Candidates published in or after this year. */
    sinceYear: number;
    sort: Sort;
}

export const defaultFilters = (year = new Date().getFullYear()): Filters => ({
    phases: [],
    ready: false,
    idleDays: null,
    suppressed: null,
    emailed: null,
    search: '',
    sinceYear: year,
    sort: 'newest_paper',
});

export const PRESETS: { label: string; filters: Partial<Filters> }[] = [
    { label: 'Everything', filters: {} },
    { label: 'To build', filters: { phases: ['not_started'] } },
    { label: 'To approve', filters: { phases: ['drafting'] } },
    { label: 'Ready to email', filters: { phases: ['drafting'], ready: true } },
    { label: 'Waiting on authors', filters: { phases: ['emailed', 'uploading'], sort: 'oldest_activity' } },
    { label: 'Stale', filters: { phases: ['emailed', 'uploading'], idleDays: 14, sort: 'oldest_activity' } },
    { label: 'Done', filters: { phases: ['completed'] } },
];

export const fromCandidate = (candidate: Candidate): PaperRow => ({
    id: candidate.base_study_id,
    baseStudyId: candidate.base_study_id,
    draftId: null,
    name: candidate.name,
    journal: candidate.journal,
    year: candidate.year,
    doi: candidate.doi,
    pmid: candidate.pmid,
    pmcid: candidate.pmcid,
    stage: 'not_started',
    analyses: candidate.result_analyses,
    person: null,
    personId: null,
    createdAt: null,
    lastActivityAt: null,
    held: [],
});

export const fromDraft = (draft: DraftSummary, held: string[] = []): PaperRow => ({
    id: draft.id,
    baseStudyId: draft.base_study_id,
    draftId: draft.id,
    name: draft.name,
    journal: draft.journal,
    year: draft.year,
    doi: draft.doi,
    pmid: draft.pmid,
    pmcid: draft.pmcid,
    stage: draft.status,
    analyses: draft.analyses,
    person: draft.person,
    personId: draft.person_id,
    createdAt: draft.created_at,
    lastActivityAt: draft.last_activity_at,
    held,
});

/** Newest papers first, then the order their drafts were built. */
export const byNewestPaper = (a: { year: number | null; createdAt: string | null }, b: typeof a) =>
    (b.year ?? 0) - (a.year ?? 0) || (a.createdAt ?? '').localeCompare(b.createdAt ?? '');

/** Every paper: candidates, then drafts with what holds back each approved one. The
 * one-email-per-person rule runs over all approved drafts, newest paper first, so what is
 * held does not depend on what is filtered. */
export function paperRows(candidates: Candidate[], drafts: DraftSummary[]): PaperRow[] {
    const approved = drafts
        .filter((draft) => draft.status === 'checked')
        .map((draft) => ({ draft, year: draft.year, createdAt: draft.created_at }))
        .sort(byNewestPaper)
        .map(({ draft }) => draft);
    const held = batchBlockers(approved);
    return [...candidates.map(fromCandidate), ...drafts.map((draft) => fromDraft(draft, held.get(draft.id) ?? []))];
}

const DAY = 24 * 60 * 60 * 1000;

export function matches(row: PaperRow, filters: Filters, now = Date.now()): boolean {
    if (filters.phases.length > 0 && !filters.phases.includes(phaseOf(row.stage))) return false;
    if (filters.ready && !(row.stage === 'checked' && row.held.length === 0)) return false;
    if (filters.idleDays !== null) {
        if (!row.lastActivityAt) return false;
        if (now - new Date(row.lastActivityAt).getTime() < filters.idleDays * DAY) return false;
    }
    if (filters.suppressed !== null && (row.person?.suppressed ?? false) !== filters.suppressed) return false;
    if (filters.emailed !== null && (row.person ? row.person.messages > 0 : false) !== filters.emailed) return false;
    const words = filters.search.toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length > 0) {
        const text = `${row.name ?? ''} ${row.journal ?? ''}`.toLowerCase();
        if (!words.every((word) => text.includes(word))) return false;
    }
    return true;
}

export function sortRows(rows: PaperRow[], sort: Sort): PaperRow[] {
    const sorted = [...rows];
    if (sort === 'oldest_activity')
        sorted.sort((a, b) => (a.lastActivityAt ?? '').localeCompare(b.lastActivityAt ?? '') || byNewestPaper(a, b));
    else sorted.sort(byNewestPaper);
    return sorted;
}

const NEXT: Record<Stage, string> = {
    not_started: 'Build a draft',
    draft: 'Check and approve',
    checked: 'Ready to email',
    contacted: 'Waiting for the author',
    opened: 'Opened, nothing uploaded',
    uploading: 'Uploading, not submitted',
    submitted: 'Review the submission',
    approved: 'Publishing',
    published: 'Done',
    declined: 'Declined',
    rejected: 'Rejected',
    failed: 'Publishing failed: retry',
    files_deleted: 'Files deleted',
};

/** What happens next for the paper, or why it is held. */
export const nextStep = (row: PaperRow): string =>
    row.stage === 'checked' && row.held.length > 0 ? `Held: ${row.held.join(', ')}` : NEXT[row.stage];

// The filters live in the URL, so a filtered view can be bookmarked or shared.

const PARAMS = {
    phases: 'phase',
    ready: 'ready',
    idleDays: 'idle',
    suppressed: 'suppressed',
    emailed: 'emailed',
    search: 'q',
    sinceYear: 'year',
    sort: 'sort',
} as const;

const flag = (value: string | null) => (value === null ? null : value === '1');

export function readFilters(params: URLSearchParams, year = new Date().getFullYear()): Filters {
    const defaults = defaultFilters(year);
    const known = new Set<string>(PHASES.map((phase) => phase.key));
    const idle = params.get(PARAMS.idleDays);
    const since = Number(params.get(PARAMS.sinceYear));
    const sort = params.get(PARAMS.sort);
    return {
        phases: params.getAll(PARAMS.phases).filter((phase): phase is Phase => known.has(phase)),
        ready: params.get(PARAMS.ready) === '1',
        idleDays: idle !== null && Number.isFinite(Number(idle)) ? Math.max(0, Number(idle)) : null,
        suppressed: flag(params.get(PARAMS.suppressed)),
        emailed: flag(params.get(PARAMS.emailed)),
        search: params.get(PARAMS.search) ?? '',
        sinceYear: Number.isInteger(since) && since > 1900 ? since : defaults.sinceYear,
        sort: sort === 'oldest_activity' ? 'oldest_activity' : defaults.sort,
    };
}

export function writeFilters(filters: Filters, year = new Date().getFullYear()): URLSearchParams {
    const params = new URLSearchParams();
    filters.phases.forEach((phase) => params.append(PARAMS.phases, phase));
    if (filters.ready) params.set(PARAMS.ready, '1');
    if (filters.idleDays !== null) params.set(PARAMS.idleDays, String(filters.idleDays));
    if (filters.suppressed !== null) params.set(PARAMS.suppressed, filters.suppressed ? '1' : '0');
    if (filters.emailed !== null) params.set(PARAMS.emailed, filters.emailed ? '1' : '0');
    if (filters.search) params.set(PARAMS.search, filters.search);
    if (filters.sinceYear !== year) params.set(PARAMS.sinceYear, String(filters.sinceYear));
    if (filters.sort !== 'newest_paper') params.set(PARAMS.sort, filters.sort);
    return params;
}
