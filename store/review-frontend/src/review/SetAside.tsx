import {
    Alert,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControlLabel,
    Radio,
    RadioGroup,
    TextField,
} from '@mui/material';
import { useId, useState } from 'react';
import type { SetAside } from '../api/reviewApi';
import { useOpClient, useSession } from '../store/context';
import { SET_ASIDE_REASONS } from './asideReasons';
import { Hint } from './Hint';

const REASONS = Object.entries(SET_ASIDE_REASONS) as [SetAside['reason'], string][];

function SetAsideDialog({ onClose }: { onClose(): void }) {
    const client = useOpClient();
    const id = useId();
    const [reason, setReason] = useState<SetAside['reason'] | ''>('');
    const [note, setNote] = useState('');
    const [error, setError] = useState<{ on: 'reason' | 'note' | 'server'; message: string } | null>(null);
    const [busy, setBusy] = useState(false);

    const submit = () => {
        if (!reason) return setError({ on: 'reason', message: 'pick a reason' });
        // the server refuses this too; checked here so the dialog can say so beside the note
        if (reason === 'other' && !note.trim())
            return setError({ on: 'note', message: 'a note is required with “other”' });
        setBusy(true);
        client
            .changeState('set_aside', { reason, note: note.trim() || null })
            .then(onClose)
            .catch((e: Error) => setError({ on: 'server', message: e.message }))
            .finally(() => setBusy(false));
    };

    return (
        <Dialog open onClose={onClose} aria-labelledby={`${id}-title`}>
            <DialogTitle id={`${id}-title`}>Set this paper aside</DialogTitle>
            <DialogContent>
                <RadioGroup
                    aria-label="reason"
                    value={reason}
                    onChange={(event) => {
                        setReason(event.target.value as SetAside['reason']);
                        setError(null);
                    }}
                >
                    {REASONS.map(([value, label]) => (
                        <FormControlLabel key={value} value={value} label={label} control={<Radio size="small" />} />
                    ))}
                </RadioGroup>
                <TextField
                    id={`${id}-note`}
                    fullWidth
                    size="small"
                    label="note"
                    value={note}
                    error={error?.on === 'note'}
                    helperText={error?.on === 'note' ? error.message : undefined}
                    inputProps={{ maxLength: 10000 }}
                    onChange={(event) => {
                        setNote(event.target.value);
                        setError(null);
                    }}
                />
                {error && error.on !== 'note' && (
                    <Alert severity="error" sx={{ mt: 1 }}>
                        {error.message}
                    </Alert>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button variant="contained" disabled={busy} onClick={submit}>
                    Set aside
                </Button>
            </DialogActions>
        </Dialog>
    );
}

/** Sets the paper aside, with a reason, from any step while the review is in progress. */
export function SetAsideButton() {
    const open = useSession((s) => s.bundle.review?.state === 'in_progress');
    const [asking, setAsking] = useState(false);
    if (!open) return null;
    return (
        <>
            <Hint title="Set this paper aside, with a reason, without finishing it">
                <Button size="small" onClick={() => setAsking(true)} sx={{ mr: 2, flexShrink: 0 }}>
                    Set aside
                </Button>
            </Hint>
            {asking && <SetAsideDialog onClose={() => setAsking(false)} />}
        </>
    );
}

/** While the paper is set aside: why, and a way to resume it. */
export function SetAsideBanner() {
    const setAside = useSession((s) =>
        s.bundle.review?.state === 'set_aside' ? s.bundle.review.set_aside : undefined
    );
    if (!setAside) return null;
    return <Resume setAside={setAside} />;
}

function Resume({ setAside }: { setAside: SetAside }) {
    const client = useOpClient();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const resume = () => {
        setBusy(true);
        setError(null);
        client
            .changeState('in_progress')
            .catch((e: Error) => setError(e.message))
            .finally(() => setBusy(false));
    };
    return (
        <Alert
            role="status"
            aria-label="set aside"
            severity="info"
            square
            action={
                <Button size="small" disabled={busy} onClick={resume}>
                    Resume
                </Button>
            }
        >
            {`Set aside: ${SET_ASIDE_REASONS[setAside.reason]}.${setAside.note ? ` ${setAside.note}` : ''}`}
            {error && ` ${error}`}
        </Alert>
    );
}
