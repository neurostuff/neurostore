import { Alert, Box, Button, Chip, Paper, Stack, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import { when } from '../format';
import { ISSUE_REASONS } from '../share/types';
import type { AdminUpload, DraftDetail, Issue } from '../types';

const FIT_LABELS: Record<string, { label: string; color: 'success' | 'warning' | 'default' }> = {
    match: { label: 'peaks match', color: 'success' },
    reversed_sign: { label: 'opposite sign', color: 'warning' },
    lr_flip: { label: 'left/right swapped', color: 'warning' },
    no_match: { label: 'peaks not found', color: 'warning' },
    cannot_assess: { label: "can't check", color: 'default' },
};

/** Whether the map's analyses rest on its own fit: variance maps match nothing by design,
 * and a map paired to a t/z map takes that map's analyses unless the author chose. */
const ownFit = (upload: AdminUpload, partner: AdminUpload | undefined) =>
    upload.kind !== 'variance' && !(partner && upload.assigned_by !== 'author');

/** Each statistic map, then the effect and variance maps that go with it. */
function inSets(uploads: AdminUpload[]): AdminUpload[] {
    const ids = new Set(uploads.map((upload) => upload.id));
    const leaders = uploads.filter((upload) => !upload.partner_id || !ids.has(upload.partner_id));
    return leaders.flatMap((leader) => [leader, ...uploads.filter((upload) => upload.partner_id === leader.id)]);
}

/** What the author uploaded: each file's kind, checks, and the analyses it is for. */
export function Uploads({
    draft,
    onDownload,
}: {
    draft: DraftDetail;
    onDownload: (upload: AdminUpload) => void;
}) {
    const name = (key: string) => draft.analyses.find((a) => a.key === key)?.name ?? key;
    const byId = new Map(draft.uploads.map((upload) => [upload.id, upload]));
    if (draft.uploads.length === 0)
        return (
            <Stack spacing={1}>
                <Typography variant="h6" component="h2">
                    Uploads
                </Typography>
                <Typography variant="body2">Nothing uploaded yet.</Typography>
            </Stack>
        );
    return (
        <Stack spacing={1}>
            <Typography variant="h6" component="h2">
                Uploads ({draft.files ?? 0} kept)
            </Typography>
            {draft.submitter_name && (
                <Typography variant="body2">
                    Submitted by {draft.submitter_name}
                    {draft.submitter_orcid && ` (ORCID ${draft.submitter_orcid}, not verified)`}
                </Typography>
            )}
            {inSets(draft.uploads).map((upload) => {
                const partner = upload.partner_id ? byId.get(upload.partner_id) : undefined;
                const deleted = Boolean(upload.deleted_at);
                return (
                    <Paper
                        key={upload.id}
                        variant="outlined"
                        style={partner ? { marginLeft: 24 } : undefined}
                        sx={{ p: 1.5, opacity: deleted ? 0.55 : 1 }}
                    >
                        <Stack spacing={0.75}>
                            <Stack direction="row" spacing={1} alignItems="center">
                                <Typography variant="subtitle2" sx={{ flexGrow: 1, overflowWrap: 'anywhere' }}>
                                    {upload.path ?? upload.filename}
                                </Typography>
                                {!deleted && (
                                    <Button size="small" onClick={() => onDownload(upload)}>
                                        Download
                                    </Button>
                                )}
                            </Stack>
                            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap alignItems="center">
                                <Chip size="small" label={upload.map_type ?? 'other'} />
                                {upload.check_status === 'problem' && <Chip size="small" color="error" label="unusable" />}
                                {upload.thresholded && <Chip size="small" color="warning" label="thresholded" />}
                                {ownFit(upload, partner) &&
                                    upload.analysis_keys.map((key) => {
                                        const fit = upload.fits[key];
                                        const shown = fit ? FIT_LABELS[fit.outcome] : undefined;
                                        const score = fit?.score !== null && fit?.score !== undefined ? ` · ${fit.score.toFixed(2)}` : '';
                                        return (
                                            <Chip
                                                key={key}
                                                size="small"
                                                color={shown?.color ?? 'default'}
                                                variant="outlined"
                                                title={fit?.reason ?? undefined}
                                                label={`${name(key)}: ${shown?.label ?? 'not checked'}${score}${
                                                    upload.assigned_by === 'suggestion' ? ' (suggested)' : ''
                                                }`}
                                            />
                                        );
                                    })}
                                {!ownFit(upload, partner) && upload.analysis_keys.length > 0 && (
                                    <Typography variant="caption">
                                        for {upload.analysis_keys.map(name).join(', ')}
                                        {partner && upload.assigned_by !== 'author' && ', as its t/z map is'}
                                    </Typography>
                                )}
                                {upload.analysis_keys.length === 0 &&
                                    (upload.label ? (
                                        <Chip size="small" color="info" variant="outlined" label={`author's label: “${upload.label}”`} />
                                    ) : (
                                        <Typography variant="caption" color="text.secondary">
                                            no analysis
                                        </Typography>
                                    ))}
                            </Stack>
                            <Typography variant="caption" color="text.secondary">
                                {partner &&
                                    `with ${partner.filename}, paired ${upload.partner_by ?? ''}${
                                        upload.partner_r !== null ? ` (r = ${upload.partner_r.toFixed(2)})` : ''
                                    }${upload.reversed ? ', runs opposite' : ''} · `}
                                {upload.assigned_by && `analyses by ${upload.assigned_by} · `}
                                uploaded {when(upload.created_at)}
                                {deleted && ` · deleted ${when(upload.deleted_at)} by ${upload.deleted_by}`}
                            </Typography>
                            {upload.problem && (
                                <Alert severity="error" sx={{ py: 0 }}>
                                    {upload.problem}
                                </Alert>
                            )}
                        </Stack>
                    </Paper>
                );
            })}
        </Stack>
    );
}

function IssueRow({
    issue,
    analysis,
    busy,
    onResolve,
}: {
    issue: Issue;
    analysis: string | null;
    busy: boolean;
    onResolve: (resolution: string) => void;
}) {
    const [resolution, setResolution] = useState('');
    const what =
        issue.kind === 'help'
            ? 'Asked for help'
            : (ISSUE_REASONS[issue.reason as keyof typeof ISSUE_REASONS] ?? issue.reason ?? 'Reported a problem');
    return (
        <Paper variant="outlined" sx={{ p: 1.5, opacity: issue.state === 'resolved' ? 0.7 : 1 }}>
            <Stack spacing={0.75}>
                <Stack direction="row" spacing={1} alignItems="center">
                    <Chip size="small" color={issue.state === 'open' ? 'warning' : 'default'} label={issue.state} />
                    <Typography variant="subtitle2">
                        {what}
                        {analysis && `: ${analysis}`}
                    </Typography>
                </Stack>
                {issue.note && (
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                        “{issue.note}”
                    </Typography>
                )}
                <Typography variant="caption" color="text.secondary">
                    {when(issue.created_at)}
                    {issue.state === 'resolved' &&
                        ` · resolved ${when(issue.resolved_at)} by ${issue.resolved_by}${
                            issue.resolution ? `: ${issue.resolution}` : ''
                        }`}
                </Typography>
                {issue.state === 'open' && (
                    <Stack direction="row" spacing={1}>
                        <TextField
                            size="small"
                            label="What you did (optional)"
                            value={resolution}
                            onChange={(event) => setResolution(event.target.value)}
                            sx={{ flexGrow: 1 }}
                        />
                        <Button size="small" disabled={busy} onClick={() => onResolve(resolution)}>
                            Resolve
                        </Button>
                    </Stack>
                )}
            </Stack>
        </Paper>
    );
}

/** What the author reported: analyses they say are wrong or missing, and help requests. */
export function Issues({
    draft,
    busy,
    onResolve,
}: {
    draft: DraftDetail;
    busy: boolean;
    onResolve: (issue: Issue, resolution: string) => void;
}) {
    if (draft.issues.length === 0) return null;
    return (
        <Stack spacing={1}>
            <Typography variant="h6" component="h2">
                Reported by the author ({draft.open_issues ?? 0} open)
            </Typography>
            {draft.issues.map((issue) => (
                <IssueRow
                    key={issue.id}
                    issue={issue}
                    analysis={issue.analysis_key ? (draft.analyses.find((a) => a.key === issue.analysis_key)?.name ?? null) : null}
                    busy={busy}
                    onResolve={(resolution) => onResolve(issue, resolution)}
                />
            ))}
            <Box />
        </Stack>
    );
}
