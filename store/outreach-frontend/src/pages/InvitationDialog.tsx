import {
    Alert,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import { useState } from 'react';
import type { Invitation } from '../types';

function Copyable({ label, value, multiline = false }: { label: string; value: string; multiline?: boolean }) {
    const [copied, setCopied] = useState(false);
    return (
        <Stack direction="row" spacing={1} alignItems="flex-start">
            <TextField
                fullWidth
                size="small"
                label={label}
                value={value}
                multiline={multiline}
                minRows={multiline ? 12 : undefined}
                InputProps={{ readOnly: true }}
            />
            <Button
                onClick={() =>
                    navigator.clipboard.writeText(value).then(
                        () => setCopied(true),
                        () => setCopied(false)
                    )
                }
            >
                {copied ? 'Copied' : 'Copy'}
            </Button>
        </Stack>
    );
}

/** The email to copy into your own mail client, then mark as sent. The link is shown only
 * here; links made before it keep working until revoked. */
export function InvitationDialog({
    invitation,
    alreadyEmailed,
    sending,
    error,
    onSent,
    onClose,
}: {
    invitation: Invitation;
    alreadyEmailed: boolean;
    sending: boolean;
    error: string | null;
    onSent: (sent: { batch?: string; kind: 'invite' | 'reminder'; template_version: string }) => void;
    onClose: () => void;
}) {
    const [batch, setBatch] = useState('pilot-1');
    const { email } = invitation;
    const kind = alreadyEmailed ? 'reminder' : 'invite';
    return (
        <Dialog open fullWidth maxWidth="md" onClose={onClose}>
            <DialogTitle>{alreadyEmailed ? 'Reminder email' : 'Invitation email'}</DialogTitle>
            <DialogContent>
                <Stack spacing={2} sx={{ pt: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                        Copy these into your own email and send it, then mark it sent. This link works until{' '}
                        {new Date(invitation.expires_at).toLocaleDateString()}. Links made earlier keep working, so an
                        email already sent still opens the page; Revoke links on the draft stops them all.
                    </Typography>
                    {!email.to && <Alert severity="warning">No address is stored for this person.</Alert>}
                    <Copyable label="To" value={email.to ?? ''} />
                    <Copyable label="Subject" value={email.subject} />
                    <Copyable label="Body" value={email.body} multiline />
                    <TextField size="small" label="Batch" value={batch} onChange={(event) => setBatch(event.target.value)} />
                    {error && <Alert severity="error">{error}</Alert>}
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Close</Button>
                <Button
                    variant="contained"
                    disabled={sending}
                    onClick={() => onSent({ batch: batch || undefined, kind, template_version: email.template_version })}
                >
                    Mark {kind} sent
                </Button>
            </DialogActions>
        </Dialog>
    );
}
