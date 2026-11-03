import {
    Alert,
    Box,
    Button,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    Link,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useApi } from '../context';
import { STATUS_LABELS, when } from '../format';

type Suppression = 'opt_out' | 'bounced';

const ASK: Record<Suppression, { title: string; text: string; confirm: string }> = {
    opt_out: {
        title: 'Mark this author opted out',
        text: 'Nothing more is sent to them about any paper.',
        confirm: 'Opted out',
    },
    bounced: {
        title: "Mark this author's address bounced",
        text: 'Nothing more is sent to this address about any paper.',
        confirm: 'Bounced',
    },
};

/** Who the draft is addressed to: their other papers, what we sent them, and whether we may
 * write again. The address itself is shown only in the invitation email. */
export function PersonPanel({ personId, draftId }: { personId: string; draftId: string }) {
    const api = useApi();
    const queryClient = useQueryClient();
    const [note, setNote] = useState('');
    const [asking, setAsking] = useState<{ what: Suppression; undo: boolean } | null>(null);
    const person = useQuery({ queryKey: ['person', personId], queryFn: () => api.person(personId) });
    const change = useMutation({
        mutationFn: ({ what, undo }: { what: Suppression; undo: boolean }) =>
            undo ? api.unsuppress(personId, what) : api.suppress(personId, what, note || undefined),
        onSuccess: () => {
            setNote('');
            setAsking(null);
            void queryClient.invalidateQueries({ queryKey: ['person', personId] });
            void queryClient.invalidateQueries({ queryKey: ['draft', draftId] });
            void queryClient.invalidateQueries({ queryKey: ['drafts'] });
        },
    });
    if (person.error) return <Alert severity="error">{String(person.error)}</Alert>;
    if (!person.data) return null;
    const { data } = person;
    const others = data.drafts.filter((d) => d.id !== draftId);
    const ask = (what: Suppression, undo = false) => {
        change.reset();
        setAsking({ what, undo });
    };
    return (
        <Stack spacing={1}>
            <Typography variant="h6" component="h2">
                Author
            </Typography>
            <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" useFlexGap>
                {data.opted_out_at && (
                    <Chip
                        size="small"
                        color="error"
                        label={`opted out ${when(data.opted_out_at)}${data.asked_to_stop ? ' on their page' : ''}`}
                        onDelete={data.asked_to_stop ? undefined : () => ask('opt_out', true)}
                    />
                )}
                {data.bounced_at && (
                    <Chip
                        size="small"
                        color="error"
                        label={`bounced ${when(data.bounced_at)}`}
                        onDelete={() => ask('bounced', true)}
                    />
                )}
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
                    <Button size="small" color="error" onClick={() => ask('opt_out')}>
                        Opted out
                    </Button>
                    <Button size="small" color="error" onClick={() => ask('bounced')}>
                        Bounced
                    </Button>
                </Stack>
            )}
            {asking && (
                <Dialog open fullWidth maxWidth="sm" onClose={() => setAsking(null)}>
                    <DialogTitle>
                        {asking.undo
                            ? `Undo the ${asking.what === 'opt_out' ? 'opt-out' : 'bounce'}`
                            : ASK[asking.what].title}
                    </DialogTitle>
                    <DialogContent>
                        <Stack spacing={2} sx={{ pt: 1 }}>
                            <DialogContentText>
                                {asking.undo
                                    ? 'Only if it was recorded by mistake: if the author asked us to stop, leave it. ' +
                                      'The undo is noted on their record.'
                                    : `${ASK[asking.what].text} You can undo this if it was a mistake.`}
                            </DialogContentText>
                            {!asking.undo && (
                                <TextField
                                    size="small"
                                    label="Note (optional)"
                                    value={note}
                                    onChange={(event) => setNote(event.target.value)}
                                />
                            )}
                            {change.error && <Alert severity="error">{String(change.error)}</Alert>}
                        </Stack>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setAsking(null)}>Cancel</Button>
                        <Button
                            variant="contained"
                            color={asking.undo ? 'primary' : 'error'}
                            disabled={change.isPending}
                            onClick={() => change.mutate(asking)}
                        >
                            {asking.undo ? 'Undo' : ASK[asking.what].confirm}
                        </Button>
                    </DialogActions>
                </Dialog>
            )}
        </Stack>
    );
}
