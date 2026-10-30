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
export const OUTCOME_STATUSES = ['declined', 'excluded', 'rejected', 'failed', 'files_deleted'] as const;
export type DraftStatus = (typeof PROGRESS_STATUSES)[number] | (typeof OUTCOME_STATUSES)[number];

/** The analysis software a paper reports (store/backend/neurostore/outreach/software.py). */
export interface Software {
    packages: string[];
    /** Whose software the packages come from: the model estimation's, else preprocessing's. */
    source: 'ModelEstimation' | 'Preprocessing' | null;
    /** Every software text the extraction read, for a tooltip. */
    texts: string[];
}

/** Packages whose group outputs are the most recognisable (cope/varcope/zstat, con/spmT,
 * bucket sub-bricks, effect_size, stat-effect). */
export const PREFERRED_SOFTWARE = ['FSL', 'SPM', 'AFNI', 'nilearn', 'FitLins'] as const;
export const OTHER_SOFTWARE = ['BrainVoyager', 'CONN', 'fMRIPrep', 'FreeSurfer'] as const;

export interface Candidate {
    base_study_id: string;
    name: string | null;
    year: number | null;
    doi: string | null;
    pmid: string | null;
    pmcid: string | null;
    journal: string | null;
    result_analyses: number;
    software?: Software | null;
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
    /** Messages to this address. */
    messages: number;
    /** Messages to the same author under any of their addresses. */
    author_messages: number;
    notes: string | null;
}

export const REPLY_KINDS = ['will_upload', 'no_maps', 'wrong_person', 'already_shared', 'declined', 'other'] as const;
export type ReplyKind = (typeof REPLY_KINDS)[number];
export const EXCLUSION_REASONS = [
    'behavioral_only',
    'roi_only',
    'connectivity_only',
    'no_group_maps',
    'not_fmri',
    'other',
] as const;
export type ExclusionReason = (typeof EXCLUSION_REASONS)[number];

export interface Reply {
    kind: ReplyKind;
    note: string | null;
    link: string | null;
    at: string;
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
    last_reply: Reply | null;
    software?: Software | null;
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
