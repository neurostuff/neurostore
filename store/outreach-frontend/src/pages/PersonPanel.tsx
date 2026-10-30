import { Alert, Box, Button, Chip, Link, Stack, TextField, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useApi } from '../context';
import { STATUS_LABELS, when } from '../format';

/** Who the draft is addressed to: their other papers, what we sent them, and whether we may
 * write again. The address itself is shown only in the invitation email. */
export function PersonPanel({ personId, draftId }: { personId: string; draftId: string }) {
    const api = useApi();
    const queryClient = useQueryClient();
    const [note, setNote] = useState('');
    const person = useQuery({ queryKey: ['person', personId], queryFn: () => api.person(personId) });
    const suppress = useMutation({
        mutationFn: (what: 'opt_out' | 'bounced') => api.suppress(personId, what, note || undefined),
        onSuccess: () => {
            setNote('');
            void queryClient.invalidateQueries({ queryKey: ['person', personId] });
            void queryClient.invalidateQueries({ queryKey: ['draft', draftId] });
            void queryClient.invalidateQueries({ queryKey: ['drafts'] });
        },
    });
    if (person.error) return <Alert severity="error">{String(person.error)}</Alert>;
    if (!person.data) return null;
    const { data } = person;
    const others = data.drafts.filter((d) => d.id !== draftId);
    return (
        <Stack spacing={1}>
            <Typography variant="h6" component="h2">
                Author
            </Typography>
            <Stack direction="row" spacing={0.5}>
                {data.opted_out_at && <Chip size="small" color="error" label={`opted out ${when(data.opted_out_at)}`} />}
                {data.bounced_at && <Chip size="small" color="error" label={`bounced ${when(data.bounced_at)}`} />}
                {!data.suppressed && <Chip size="small" label="may be emailed" />}
            </Stack>
            {data.notes && (
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {data.notes}
                </Typography>
            )}
            <Box>
                <Typography variant="subtitle2">Emails sent</Typography>
                {data.sent.length === 0 && <Typography variant="body2">None.</Typography>}
                {data.sent.map((sent) => (
                    <Typography variant="body2" key={`${sent.draft_id}-${sent.sent_at}`}>
                        {sent.kind} · {when(sent.sent_at)}
                        {sent.batch && ` · ${sent.batch}`}
                        {sent.draft_id !== draftId && ' · about another paper'}
                    </Typography>
                ))}
            </Box>
            <Box>
                <Typography variant="subtitle2">Their other papers in outreach</Typography>
                {others.length === 0 && <Typography variant="body2">None.</Typography>}
                {others.map((other) => (
                    <Typography variant="body2" key={other.id}>
                        <Link component={RouterLink} to={`/drafts/${other.id}`}>
                            {other.name}
                        </Link>{' '}
                        ({STATUS_LABELS[other.status]})
                    </Typography>
                ))}
            </Box>
            {!data.suppressed && (
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                    <TextField
                        size="small"
                        label="Note"
                        value={note}
                        onChange={(event) => setNote(event.target.value)}
                        sx={{ flexGrow: 1, minWidth: 140 }}
                    />
                    <Button size="small" color="error" disabled={suppress.isPending} onClick={() => suppress.mutate('opt_out')}>
                        Opted out
                    </Button>
                    <Button size="small" color="error" disabled={suppress.isPending} onClick={() => suppress.mutate('bounced')}>
                        Bounced
                    </Button>
                </Stack>
            )}
            {suppress.error && <Alert severity="error">{String(suppress.error)}</Alert>}
        </Stack>
    );
}
