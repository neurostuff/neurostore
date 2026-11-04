const DAY = 24 * 60 * 60 * 1000;

/** Whole days between ``iso`` and ``now``. */
export function daysSince(iso: string, now = Date.now()): number {
    return Math.floor((now - new Date(iso).getTime()) / DAY);
}

export function ago(iso: string, now = Date.now()): string {
    const days = daysSince(iso, now);
    if (days <= 0) return 'today';
    if (days === 1) return 'yesterday';
    return `${days} days ago`;
}

export function when(iso: string | null): string {
    return iso ? new Date(iso).toLocaleString() : '';
}

export const STATUS_LABELS: Record<string, string> = {
    not_started: 'Not started',
    draft: 'Draft',
    checked: 'Approved draft',
    contacted: 'Emailed',
    opened: 'Opened',
    uploading: 'Uploading',
    submitted: 'Submitted',
    approved: 'Approved',
    published: 'Published',
    declined: 'Declined',
    excluded: 'Excluded',
    rejected: 'Rejected',
    failed: 'Failed',
    files_deleted: 'Files deleted',
};

export const REPLY_LABELS: Record<string, string> = {
    will_upload: 'Will upload',
    no_maps: 'No maps',
    wrong_person: 'Wrong person',
    already_shared: 'Already shared',
    declined: 'Declined',
    other: 'Other',
};

export const EXCLUSION_LABELS: Record<string, string> = {
    behavioral_only: 'Behavioral results only',
    roi_only: 'ROI results only',
    connectivity_only: 'Connectivity results only',
    no_group_maps: 'No group-level maps',
    not_fmri: 'Not fMRI',
    other: 'Other',
};
