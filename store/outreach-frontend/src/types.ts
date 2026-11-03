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
    /** Files the author uploaded and still kept. */
    files?: number;
    /** Problems the author reported that are not resolved yet. */
    open_issues?: number;
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

export interface AdminUpload {
    id: string;
    filename: string;
    path: string | null;
    kind: 'statistic' | 'effect' | 'variance' | 'other';
    map_type: string | null;
    map_type_by: string | null;
    partner_id: string | null;
    partner_r: number | null;
    partner_by: string | null;
    reversed: boolean;
    size_bytes: number;
    sha256: string;
    check_status: 'ok' | 'problem' | null;
    problem: string | null;
    thresholded: boolean | null;
    analysis_keys: string[];
    assigned_by: string | null;
    label: string | null;
    fits: Record<string, { outcome: string; score: number | null; reason: string | null } | null>;
    created_at: string;
    deleted_at: string | null;
    deleted_by: string | null;
}

export interface Issue {
    id: string;
    kind: 'extraction_error' | 'help' | 'mismatch';
    analysis_key: string | null;
    reason: string | null;
    note: string | null;
    state: 'open' | 'resolved';
    resolution: string | null;
    resolved_by: string | null;
    resolved_at: string | null;
    created_at: string;
}

export interface DraftDetail extends Omit<DraftSummary, 'analyses'> {
    uploads: AdminUpload[];
    issues: Issue[];
    submitter_name: string | null;
    submitter_orcid: string | null;
    submitter_orcid_verified: boolean;
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
    /** They asked to stop on their own page; that opt-out cannot be undone here. */
    asked_to_stop: boolean;
    drafts: { id: string; name: string | null; year: number | null; status: DraftStatus }[];
    sent: { draft_id: string; kind: 'invite' | 'reminder'; batch: string | null; sent_at: string; sent_by: string | null }[];
}
