import { Alert, Button, Divider, Grid, Link, Paper, Stack, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { PaperLinks, PersonFlags, SoftwareChips, StatusChip } from '../components';
import { useApi } from '../context';
import { ago, REPLY_LABELS, when } from '../format';
import type { DraftDetail, Invitation } from '../types';
import { AnalysesEditor } from './AnalysesEditor';
import { CollectionEditor } from './CollectionEditor';
import { sentHere as wasSent } from '../drafts';
import { DraftActions } from './DraftActions';
import { InvitationDialog } from './InvitationDialog';
import { PersonPanel } from './PersonPanel';

const FROZEN = ['approved', 'published'];

function Events({ draft }: { draft: DraftDetail }) {
    return (
        <Stack spacing={0.5}>
            <Typography variant="h6" component="h2">
                History
            </Typography>
            {[...draft.events].reverse().map((event, index) => {
                const data = event.data ?? {};
                const detail = [
                    typeof data.reply === 'string' ? REPLY_LABELS[data.reply] ?? data.reply : null,
                    typeof data.reason === 'string' ? data.reason.replace(/_/g, ' ') : null,
                    typeof data.note === 'string' ? `“${data.note}”` : null,
                ].filter(Boolean);
                return (
                    <Typography
                        variant="body2"
                        key={`${event.created_at}-${index}`}
                        sx={data.undone_at ? { textDecoration: 'line-through', color: 'text.disabled' } : undefined}
                    >
                        {when(event.created_at)} · {event.kind.replace(/_/g, ' ')}
                        {detail.length > 0 && `: ${detail.join(' · ')}`} · {event.actor}
                        {event.actor_id && ` (${event.actor_id})`}
                    </Typography>
                );
            })}
        </Stack>
    );
}

export function DraftPage() {
    const { draftId = '' } = useParams();
    const api = useApi();
    const queryClient = useQueryClient();
    const [invitation, setInvitation] = useState<Invitation | null>(null);
    const draft = useQuery({ queryKey: ['draft', draftId], queryFn: () => api.draft(draftId) });

    const refresh = (next: DraftDetail) => {
        queryClient.setQueryData(['draft', draftId], next);
        void queryClient.invalidateQueries({ queryKey: ['drafts'] });
        if (next.person_id) void queryClient.invalidateQueries({ queryKey: ['person', next.person_id] });
    };
    const edit = useMutation({ mutationFn: (change: Parameters<typeof api.editDraft>[1]) => api.editDraft(draftId, change), onSuccess: refresh });
    const check = useMutation({ mutationFn: () => api.checkDraft(draftId), onSuccess: refresh });
    const invite = useMutation({ mutationFn: () => api.invitation(draftId), onSuccess: setInvitation });
    const sent = useMutation({
        mutationFn: (body: Parameters<typeof api.markSent>[1]) => api.markSent(draftId, body),
        onSuccess: (next) => {
            refresh(next);
            setInvitation(null);
        },
    });

    if (draft.error) return <Alert severity="error">{String(draft.error)}</Alert>;
    if (!draft.data) return null;
    const data = draft.data;
    const frozen = FROZEN.includes(data.status);
    const sentHere = wasSent(data);
    const emailedElsewhere = !sentHere && (data.person?.author_messages ?? 0) > 0;
    const closed = ['declined', 'excluded'].includes(data.status);
    const error = [edit.error, check.error, invite.error].find(Boolean);

    return (
        <Stack spacing={3}>
            <Stack spacing={1}>
                <Link component={RouterLink} to="/" variant="body2">
                    ← All papers
                </Link>
                <Typography variant="h5" component="h1">
                    {data.name}
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                    <StatusChip status={data.status} />
                    <PersonFlags person={data.person} />
                    <Typography variant="body2" color="text.secondary">
                        {[data.journal, data.year].filter(Boolean).join(', ')} · last activity {ago(data.last_activity_at)}
                        {data.link_expires_at && ` · link live until ${new Date(data.link_expires_at).toLocaleDateString()}`}
                    </Typography>
                    <PaperLinks doi={data.doi} pmid={data.pmid} pmcid={data.pmcid} />
                    <SoftwareChips software={data.software ?? null} />
                </Stack>
                <Stack direction="row" spacing={1}>
                    {data.status === 'draft' && (
                        <Button variant="contained" disabled={check.isPending} onClick={() => check.mutate()}>
                            Approve draft
                        </Button>
                    )}
                    {data.status !== 'draft' && !frozen && !closed && (
                        <Button
                            variant="contained"
                            disabled={invite.isPending || !data.person || data.person.suppressed || emailedElsewhere}
                            onClick={() => invite.mutate()}
                        >
                            {sentHere ? 'Make link and reminder email' : 'Make link and email'}
                        </Button>
                    )}
                </Stack>
                <DraftActions draft={data} onChange={refresh} />
                {emailedElsewhere && (
                    <Alert severity="info">
                        This author has already been emailed about another paper, so this one is held back for now.
                    </Alert>
                )}
                {error && <Alert severity="error">{String(error)}</Alert>}
            </Stack>
            <Grid container spacing={3}>
                <Grid item xs={12} md={8}>
                    <Stack spacing={3}>
                        <Paper variant="outlined" sx={{ p: 2 }}>
                            <AnalysesEditor
                                key={JSON.stringify(data.analyses)}
                                analyses={data.analyses}
                                disabled={frozen}
                                saving={edit.isPending}
                                onSave={(analyses) => edit.mutate({ analyses })}
                            />
                        </Paper>
                        <Paper variant="outlined" sx={{ p: 2 }}>
                            <CollectionEditor
                                key={JSON.stringify(data.collection)}
                                collection={data.collection}
                                disabled={frozen}
                                saving={edit.isPending}
                                onSave={(collection) => edit.mutate({ collection })}
                            />
                        </Paper>
                    </Stack>
                </Grid>
                <Grid item xs={12} md={4}>
                    <Stack spacing={3}>
                        {data.person_id ? (
                            <PersonPanel personId={data.person_id} draftId={data.id} />
                        ) : (
                            <Alert severity="warning">The paper gives no corresponding author address.</Alert>
                        )}
                        <Divider />
                        <Events draft={data} />
                    </Stack>
                </Grid>
            </Grid>
            {invitation && (
                <InvitationDialog
                    invitation={invitation}
                    alreadyEmailed={sentHere}
                    sending={sent.isPending}
                    error={sent.error ? String(sent.error) : null}
                    onSent={(body) => sent.mutate(body)}
                    onClose={() => setInvitation(null)}
                />
            )}
        </Stack>
    );
}
