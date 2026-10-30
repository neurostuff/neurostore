import {
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
import { useState, type ReactNode } from 'react';
import { AUTHOR_REPLIES, ISSUE_REASONS, type AuthorReply, type IssueReason, type ShareAnalysis } from './types';

function Frame({
    open,
    title,
    confirm,
    canSend,
    onClose,
    onSend,
    children,
}: {
    open: boolean;
    title: string;
    confirm: string;
    canSend: boolean;
    onClose: () => void;
    onSend: () => void;
    children: ReactNode;
}) {
    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle>{title}</DialogTitle>
            <DialogContent>
                <Stack spacing={2} sx={{ pt: 1 }}>
                    {children}
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button variant="contained" disabled={!canSend} onClick={onSend}>
                    {confirm}
                </Button>
            </DialogActions>
        </Dialog>
    );
}

/** "Something's wrong with this analysis", or, with no analysis, "an analysis is missing". */
export function IssueDialog({
    open,
    analysis,
    onClose,
    onSend,
}: {
    open: boolean;
    analysis: ShareAnalysis | null;
    onClose: () => void;
    onSend: (issue: { kind: 'extraction_error'; analysis_key?: string; reason: IssueReason; note?: string }) => void;
}) {
    const [reason, setReason] = useState<IssueReason>('wrong_coordinates');
    const [note, setNote] = useState('');
    const chosen = analysis ? reason : 'missing_analysis';
    return (
        <Frame
            open={open}
            title={analysis ? `Something's wrong with “${analysis.name}”` : 'An analysis is missing'}
            confirm="Tell us"
            canSend={chosen !== 'other' || note.trim() !== ''}
            onClose={onClose}
            onSend={() => onSend({ kind: 'extraction_error', analysis_key: analysis?.key, reason: chosen, note: note || undefined })}
        >
            {analysis && (
                <TextField select size="small" label="What's wrong" value={reason} onChange={(e) => setReason(e.target.value as IssueReason)}>
                    {(Object.keys(ISSUE_REASONS) as IssueReason[])
                        .filter((key) => key !== 'missing_analysis')
                        .map((key) => (
                            <MenuItem key={key} value={key}>
                                {ISSUE_REASONS[key]}
                            </MenuItem>
                        ))}
                </TextField>
            )}
            <TextField
                size="small"
                multiline
                minRows={3}
                label={analysis ? 'Anything we should know (optional)' : 'Which analysis, and where in the paper?'}
                value={note}
                onChange={(e) => setNote(e.target.value)}
            />
            <DialogContentText variant="body2">
                You can still upload your maps: a map for an analysis we missed can be described in its own row.
            </DialogContentText>
        </Frame>
    );
}

/** Answers without uploading: no maps, wrong person, already shared, rather not, stop. */
export function ReplyDialog({
    open,
    onClose,
    onSend,
}: {
    open: boolean;
    onClose: () => void;
    onSend: (reply: { kind: AuthorReply; note?: string; link?: string }) => void;
}) {
    const [kind, setKind] = useState<AuthorReply>('no_maps');
    const [note, setNote] = useState('');
    const [link, setLink] = useState('');
    return (
        <Frame
            open={open}
            title="Can't share these maps?"
            confirm={kind === 'unsubscribe' ? 'Stop emails' : 'Send'}
            canSend
            onClose={onClose}
            onSend={() => onSend({ kind, note: note || undefined, link: link || undefined })}
        >
            <TextField select size="small" label="Which is it" value={kind} onChange={(e) => setKind(e.target.value as AuthorReply)}>
                {(Object.keys(AUTHOR_REPLIES) as AuthorReply[]).map((key) => (
                    <MenuItem key={key} value={key}>
                        {AUTHOR_REPLIES[key]}
                    </MenuItem>
                ))}
            </TextField>
            {kind === 'already_shared' && (
                <TextField size="small" label="Where are they?" value={link} onChange={(e) => setLink(e.target.value)} />
            )}
            {kind !== 'unsubscribe' && (
                <TextField
                    size="small"
                    multiline
                    minRows={2}
                    label={kind === 'wrong_person' ? 'Who should we ask instead? (optional)' : 'Anything else (optional)'}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                />
            )}
            {kind === 'unsubscribe' && (
                <DialogContentText variant="body2">We won't email this address about any paper again.</DialogContentText>
            )}
        </Frame>
    );
}

export function HelpDialog({ open, onClose, onSend }: { open: boolean; onClose: () => void; onSend: (note: string) => void }) {
    const [note, setNote] = useState('');
    return (
        <Frame open={open} title="Need help?" confirm="Send" canSend={note.trim() !== ''} onClose={onClose} onSend={() => onSend(note)}>
            <TextField
                size="small"
                multiline
                minRows={4}
                label="What's the problem?"
                value={note}
                onChange={(e) => setNote(e.target.value)}
            />
            <DialogContentText variant="body2">This reaches the person who emailed you. They will reply by email.</DialogContentText>
        </Frame>
    );
}
