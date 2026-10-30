/** The outreach admin API's shapes (store/backend/neurostore/outreach/api.py). */

export const PROGRESS_STATUSES = [
    'draft',
    'checked',
    'contacted',
    'opened',
    'uploading',
    'submitted',
    'approved',
    'published',
] as const;
export const OUTCOME_STATUSES = ['declined', 'rejected', 'failed', 'files_deleted'] as const;
export type DraftStatus = (typeof PROGRESS_STATUSES)[number] | (typeof OUTCOME_STATUSES)[number];

export interface Candidate {
    base_study_id: string;
    name: string | null;
    year: number | null;
    doi: string | null;
    pmid: string | null;
    pmcid: string | null;
    journal: string | null;
    result_analyses: number;
}

export interface Point {
    x: number;
    y: number;
    z: number;
    space: string | null;
}

export interface DraftAnalysis {
    key?: string;
    name: string;
    description: string | null;
    points: Point[];
}

export interface PersonSummary {
    id: string;
    author_id: string | null;
    opted_out_at: string | null;
    bounced_at: string | null;
    suppressed: boolean;
    messages: number;
    notes: string | null;
}

export interface DraftSummary {
    id: string;
    base_study_id: string;
    name: string | null;
    year: number | null;
    doi: string | null;
    pmid: string | null;
    pmcid: string | null;
    journal: string | null;
    status: DraftStatus;
    created_at: string;
    last_activity_at: string;
    analyses: number;
    person_id: string | null;
    person: PersonSummary | null;
}

export interface DraftEvent {
    kind: string;
    actor: 'admin' | 'author' | 'system';
    actor_id: string | null;
    data: Record<string, unknown> | null;
    created_at: string;
}

export type Collection = Partial<
    Record<'name' | 'DOI' | 'authors' | 'journal_name' | 'paper_url' | 'full_dataset_url' | 'description', string>
>;

export interface DraftDetail extends Omit<DraftSummary, 'analyses'> {
    source_study_id: string | null;
    source_sha256: string;
    analyses: DraftAnalysis[];
    collection: Collection;
    link_expires_at: string | null;
    events: DraftEvent[];
}

export interface Invitation {
    url: string;
    expires_at: string;
    email: { to: string | null; subject: string; body: string; template_version: string };
}

export interface PersonDetail extends PersonSummary {
    drafts: { id: string; name: string | null; year: number | null; status: DraftStatus }[];
    sent: { draft_id: string; kind: 'invite' | 'reminder'; batch: string | null; sent_at: string; sent_by: string | null }[];
}
