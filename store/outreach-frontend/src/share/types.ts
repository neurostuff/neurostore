/** The author's page's API shapes (store/backend/neurostore/outreach/share.py). */

export type Outcome = 'match' | 'reversed_sign' | 'lr_flip' | 'no_match' | 'cannot_assess';

export interface Fit {
    outcome: Outcome;
    score: number | null;
    reason: string | null;
}

export interface ShareUpload {
    id: string;
    filename: string;
    size_bytes: number;
    check_status: 'ok' | 'problem' | null;
    problem: string | null;
    thresholded: boolean | null;
    analysis_keys: string[];
    assigned_by: 'author' | 'suggestion' | null;
    label: string | null;
    map_type: string | null;
    /** The matcher's reading of this file against each analysis. */
    fits: Record<string, Fit | null>;
}

export interface ShareAnalysis {
    key: string;
    name: string;
    description: string | null;
    points: number;
}

export interface ShareView {
    preview: boolean;
    status: string;
    open: boolean;
    closed_reason: string | null;
    paper: {
        title: string | null;
        journal: string | null;
        year: number | null;
        authors: string | null;
        doi: string | null;
        pmid: string | null;
        pmcid: string | null;
    };
    analyses: ShareAnalysis[];
    collection: Record<string, string>;
    uploads: ShareUpload[];
    issues: { kind: string; analysis_key: string | null; reason: string | null; note: string | null }[];
    submitter_name: string | null;
    submitter_orcid: string | null;
    limits: { max_files: number; max_file_bytes: number; extensions: string[]; map_types: string[] };
}

export const ISSUE_REASONS = {
    not_an_analysis: 'This is not a real analysis',
    wrong_coordinates: 'The coordinates are wrong',
    wrong_direction: 'The direction or name is wrong',
    missing_analysis: 'An analysis is missing',
    other: 'Something else',
} as const;
export type IssueReason = keyof typeof ISSUE_REASONS;

export const AUTHOR_REPLIES = {
    no_maps: "I don't have these maps any more",
    wrong_person: "I'm not the right person",
    already_shared: 'They are already shared elsewhere',
    declined: "I'd rather not share them",
    unsubscribe: 'Stop emailing me',
} as const;
export type AuthorReply = keyof typeof AUTHOR_REPLIES;
