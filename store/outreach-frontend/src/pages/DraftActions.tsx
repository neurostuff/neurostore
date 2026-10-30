import {
    Alert,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    MenuItem,
    Stack,
    TextField,
} from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { useApi } from '../context';
import { sentHere } from '../drafts';
import { EXCLUSION_LABELS, REPLY_LABELS } from '../format';
import {
    EXCLUSION_REASONS,
    REPLY_KINDS,
    type DraftDetail,
    type ExclusionReason,
    type ReplyKind,
} from '../types';

const FROZEN = ['approved', 'published'];
const REOPENABLE = ['declined', 'excluded'];

function Ask({
    open,
    title,
    children,
    confirm,
    busy,
    error,
    onConfirm,
    onClose,
}: {
    open: boolean;
    title: string;
    children: ReactNode;
    confirm: string;
    busy: boolean;
    error: unknown;
    onConfirm: () => void;
    onClose: () => void;
}) {
    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle>{title}</DialogTitle>
            <DialogContent>
                <Stack spacing={2} sx={{ pt: 1 }}>
                    {children}
                    {Boolean(error) && <Alert severity="error">{String(error)}</Alert>}
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button variant="contained" disabled={busy} onClick={onConfirm}>
                    {confirm}
                </Button>
            </DialogActions>
        </Dialog>
    );
}

/** The actions that record what happened outside the panel, or take a mistake back: log a
 * reply, exclude or reopen the paper, undo "mark as sent", revoke links. */
export function DraftActions({ draft, onChange }: { draft: DraftDetail; onChange: (next: DraftDetail) => void }) {
    const api = useApi();
    const [open, setOpen] = useState<'reply' | 'exclude' | 'unsend' | 'revoke' | null>(null);
    const [replyKind, setReplyKind] = useState<ReplyKind>('will_upload');
    const [reason, setReason] = useState<ExclusionReason>('behavioral_only');
    const [note, setNote] = useState('');
    const [link, setLink] = useState('');
    const close = () => {
        setOpen(null);
        setNote('');
        setLink('');
    };
    const act = useMutation({
        mutationFn: (run: () => Promise<DraftDetail>) => run(),
        onSuccess: (next) => {
            onChange(next);
            close();
        },
    });
    const run = (call: () => Promise<DraftDetail>) => act.mutate(call);
    const frozen = FROZEN.includes(draft.status);
    const emailed = sentHere(draft);
    const dialog = (key: typeof open) => ({
        open: open === key,
        busy: act.isPending,
        error: open === key ? act.error : null,
        onClose: close,
    });

    return (
        <>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {emailed && !frozen && (
                    <Button size="small" variant="outlined" onClick={() => setOpen('reply')}>
                        Log reply
                    </Button>
                )}
                {REOPENABLE.includes(draft.status) ? (
                    <Button size="small" variant="outlined" onClick={() => run(() => api.reopen(draft.id))}>
                        Reopen
                    </Button>
                ) : (
                    !frozen && (
                        <Button size="small" variant="outlined" color="error" onClick={() => setOpen('exclude')}>
                            Exclude paper
                        </Button>
                    )
                )}
                {emailed && !frozen && (
                    <Button size="small" onClick={() => setOpen('unsend')}>
                        Undo mark sent
                    </Button>
                )}
                {draft.link_expires_at && (
                    <Button size="small" color="error" onClick={() => setOpen('revoke')}>
                        Revoke links
                    </Button>
                )}
                <Button
                    size="small"
                    onClick={() =>
                        api.preview(draft.id).then(
                            ({ url }) => window.open(url, '_blank', 'noopener,noreferrer'),
                            (error: unknown) => window.alert(String(error))
                        )
                    }
                >
                    Preview author page
                </Button>
            </Stack>
            {act.error && !open && <Alert severity="error">{String(act.error)}</Alert>}

            <Ask
                {...dialog('reply')}
                title="Log the author's reply"
                confirm="Log reply"
                onConfirm={() =>
                    run(() =>
                        api.logReply(draft.id, {
                            kind: replyKind,
                            note: note || undefined,
                            link: link || undefined,
                        })
                    )
                }
            >
                <TextField
                    select
                    size="small"
                    label="They said"
                    value={replyKind}
                    onChange={(event) => setReplyKind(event.target.value as ReplyKind)}
                >
                    {REPLY_KINDS.map((kind) => (
                        <MenuItem key={kind} value={kind}>
                            {REPLY_LABELS[kind]}
                        </MenuItem>
                    ))}
                </TextField>
                {replyKind === 'already_shared' && (
                    <TextField size="small" label="Where" value={link} onChange={(event) => setLink(event.target.value)} />
                )}
                <TextField
                    size="small"
                    label="Note"
                    multiline
                    minRows={2}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                />
                {replyKind === 'declined' && (
                    <DialogContentText>
                        This closes the draft as declined. To stop all emails to this author, use Opted out instead.
                    </DialogContentText>
                )}
            </Ask>

            <Ask
                {...dialog('exclude')}
                title="Exclude this paper from outreach"
                confirm="Exclude"
                onConfirm={() => run(() => api.exclude(draft.id, reason, note || undefined))}
            >
                <TextField
                    select
                    size="small"
                    label="Why"
                    value={reason}
                    onChange={(event) => setReason(event.target.value as ExclusionReason)}
                >
                    {EXCLUSION_REASONS.map((value) => (
                        <MenuItem key={value} value={value}>
                            {EXCLUSION_LABELS[value]}
                        </MenuItem>
                    ))}
                </TextField>
                <TextField
                    size="small"
                    label="Note"
                    multiline
                    minRows={2}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                />
                <DialogContentText>The draft stays, so the paper is not suggested again; Reopen undoes this.</DialogContentText>
            </Ask>

            <Ask
                {...dialog('unsend')}
                title="Undo mark sent"
                confirm="Undo"
                onConfirm={() => run(() => api.undoSent(draft.id))}
            >
                <DialogContentText>
                    Only if the email never went out. The author counts as not emailed again, and the draft goes back to
                    where it was. The link stays live; revoke it too if needed.
                </DialogContentText>
            </Ask>

            <Ask
                {...dialog('revoke')}
                title="Revoke every link to this draft"
                confirm="Revoke"
                onConfirm={() => run(() => api.revokeLinks(draft.id))}
            >
                <DialogContentText>
                    Links in emails already sent stop working. Make a new link to send another.
                </DialogContentText>
            </Ask>
        </>
    );
}
