/** The author's page's API shapes (store/backend/neurostore/outreach/share.py). */

export type Outcome = 'match' | 'reversed_sign' | 'lr_flip' | 'no_match' | 'cannot_assess';

export interface Fit {
    outcome: Outcome;
    score: number | null;
    reason: string | null;
}

export type MapKind = 'statistic' | 'effect' | 'variance' | 'other';
export const MAP_TYPES = ['t', 'z', 'f', 'effect', 'variance', 'other'] as const;
export type MapType = (typeof MAP_TYPES)[number];

export interface ShareUpload {
    id: string;
    filename: string;
    /** Where it sat in the folder the author chose. */
    path: string | null;
    kind: MapKind;
    /** How its type was told: the file's header, its name, or the author. */
    map_type_by: 'header' | 'name' | 'author' | null;
    /** The statistic map an effect or variance map goes with. */
    partner_id: string | null;
    partner_r: number | null;
    partner_by: 'name' | 'name+correlation' | 'correlation' | 'author' | null;
    /** Paired, but its values run opposite to its statistic map's. */
    reversed: boolean;
    size_bytes: number;
    check_status: 'ok' | 'problem' | null;
    problem: string | null;
    thresholded: boolean | null;
    analysis_keys: string[];
    assigned_by: 'author' | 'suggestion' | 'set' | null;
    label: string | null;
    map_type: MapType | null;
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
    software: { packages: string[]; source: string | null; texts: string[] } | null;
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
