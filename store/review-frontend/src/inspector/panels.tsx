import {
    Autocomplete,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControlLabel,
    FormHelperText,
    List,
    ListItem,
    Radio,
    RadioGroup,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { AnyTarget } from '../contract/generated/review-ops';
import type { SlotNode } from '../model/record';
import { isTextField } from '../review/shortcuts';
import { useReviewStore, useReviewStoreApi } from '../store/context';
import {
    addNote,
    createSibling,
    danglingLinks,
    deleteEntity,
    link,
    linkCandidates,
    reject,
    REJECT_REASONS,
    type RejectReason,
    siblingClasses,
} from './actions';
import { panelKeys } from './panelKeys';

export function RejectPanel({ target, label }: { target: AnyTarget; label: string }) {
    const store = useReviewStoreApi();
    const closePanel = useReviewStore((s) => s.closePanel);
    const id = useId();
    const groupRef = useRef<HTMLDivElement>(null);
    const noteRef = useRef<HTMLInputElement>(null);
    const [reason, setReason] = useState<RejectReason | ''>('');
    const [note, setNote] = useState('');
    const [error, setError] = useState<{ on: 'reason' | 'note'; message: string } | null>(null);

    useEffect(() => groupRef.current?.focus(), []);

    const pick = (next: RejectReason) => {
        setReason(next);
        setError(null);
        noteRef.current?.focus();
    };
    const submit = () => {
        if (!reason) return setError({ on: 'reason', message: 'pick a reason, 1–5' });
        if (reason === 'other' && !note.trim())
            return setError({ on: 'note', message: 'a note is required with “other”' });
        if (reject(store.getState(), target, reason, note.trim())) closePanel();
    };
    const onDigit = (event: KeyboardEvent) => {
        const picked = REJECT_REASONS[Number(event.key) - 1];
        if (!picked || isTextField(event.target)) return false;
        event.preventDefault();
        pick(picked.reason);
        return true;
    };

    return (
        <Stack
            ref={groupRef}
            role="group"
            aria-label={`reject ${label}`}
            tabIndex={-1}
            spacing={1}
            sx={{ py: 1, outline: 'none' }}
            onKeyDown={panelKeys(submit, closePanel, onDigit)}
        >
            <RadioGroup
                row
                aria-label="reason"
                aria-describedby={error?.on === 'reason' ? `${id}-reason-error` : undefined}
                value={reason}
                onChange={(event) => pick(event.target.value as RejectReason)}
            >
                {REJECT_REASONS.map(({ reason: value, label: text }, i) => (
                    <FormControlLabel
                        key={value}
                        value={value}
                        label={`${i + 1} ${text}`}
                        control={<Radio size="small" inputProps={{ 'aria-label': `${i + 1} ${text}` }} />}
                    />
                ))}
            </RadioGroup>
            {error?.on === 'reason' && (
                <FormHelperText id={`${id}-reason-error`} error>
                    {error.message}
                </FormHelperText>
            )}
            <TextField
                id={`${id}-note`}
                inputRef={noteRef}
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
            <Stack direction="row" spacing={1}>
                <Button size="small" variant="contained" color="error" onClick={submit}>
                    Reject
                </Button>
                <Button size="small" onClick={closePanel}>
                    Cancel
                </Button>
            </Stack>
        </Stack>
    );
}

export function NotePanel({ target, label }: { target: AnyTarget; label: string }) {
    const store = useReviewStoreApi();
    const closePanel = useReviewStore((s) => s.closePanel);
    const id = useId();
    const [note, setNote] = useState('');
    const [error, setError] = useState('');
    const submit = () => {
        if (!note.trim()) return setError('write a note first');
        if (addNote(store.getState(), target, note.trim())) closePanel();
    };
    return (
        <Stack spacing={1} sx={{ py: 1 }} onKeyDown={panelKeys(submit, closePanel)}>
            <TextField
                id={id}
                size="small"
                autoFocus
                label={`note on ${label}`}
                value={note}
                error={error !== ''}
                helperText={error || undefined}
                inputProps={{ maxLength: 10000 }}
                onChange={(event) => {
                    setNote(event.target.value);
                    setError('');
                }}
            />
        </Stack>
    );
}

export function LinkPanel({ slot }: { slot: SlotNode }) {
    const store = useReviewStoreApi();
    const closePanel = useReviewStore((s) => s.closePanel);
    const options = useMemo(() => linkCandidates(store.getState(), slot), [store, slot]);
    return (
        <Stack
            sx={{ py: 1 }}
            onKeyDown={(event) => {
                if (event.key === 'Escape') closePanel();
            }}
        >
            <Autocomplete
                size="small"
                openOnFocus
                autoHighlight
                options={options}
                getOptionLabel={(option) => option.name}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                noOptionsText="no entity of this class to link"
                onClose={(_, reason) => {
                    if (reason === 'escape') closePanel();
                }}
                onChange={(_, option) => {
                    if (option && link(store.getState(), slot, option.id)) closePanel();
                }}
                renderInput={(params) => <TextField {...params} autoFocus label={`link ${slot.path} to`} />}
            />
        </Stack>
    );
}

export function CreateDialog() {
    const store = useReviewStoreApi();
    const closePanel = useReviewStore((s) => s.closePanel);
    const classes = useMemo(() => siblingClasses(store.getState()), [store]);
    const titleId = useId();
    return (
        <Dialog open onClose={closePanel} aria-labelledby={titleId}>
            <DialogTitle id={titleId}>Create which kind?</DialogTitle>
            <DialogContent>
                <List dense aria-label="kinds">
                    {classes.map(({ name, title }) => (
                        <ListItem key={name} disableGutters>
                            <Button
                                onClick={() => {
                                    if (createSibling(store.getState(), name)) closePanel();
                                }}
                            >
                                {title}
                            </Button>
                        </ListItem>
                    ))}
                </List>
            </DialogContent>
            <DialogActions>
                <Button onClick={closePanel}>Cancel</Button>
            </DialogActions>
        </Dialog>
    );
}

export function DeleteDialog({ entity }: { entity: string }) {
    const store = useReviewStoreApi();
    const closePanel = useReviewStore((s) => s.closePanel);
    const name = useReviewStore((s) => s.index.entity(entity)?.name ?? entity);
    const dangling = useMemo(() => danglingLinks(store.getState(), entity), [store, entity]);
    const titleId = useId();
    const confirm = () => {
        if (deleteEntity(store.getState(), entity)) closePanel();
    };
    return (
        <Dialog open onClose={closePanel} aria-labelledby={titleId}>
            <DialogTitle id={titleId}>{`Delete ${name}?`}</DialogTitle>
            <DialogContent>
                {dangling.length === 0 ? (
                    <Typography variant="body2">Nothing links to it.</Typography>
                ) : (
                    <>
                        <Typography variant="body2">These links would be left dangling:</Typography>
                        <List dense aria-label="dangling links">
                            {dangling.map(({ entity: from, slot, target }) => (
                                <ListItem key={`${slot.key}:${target}`} disableGutters>
                                    {`${from.name} · ${slot.path} → ${target}`}
                                </ListItem>
                            ))}
                        </List>
                    </>
                )}
                <Typography variant="caption" color="text.secondary">
                    The server applies the delete and reports every link it leaves.
                </Typography>
            </DialogContent>
            <DialogActions>
                <Button onClick={closePanel}>Cancel</Button>
                <Button color="error" variant="contained" autoFocus onClick={confirm}>
                    Delete
                </Button>
            </DialogActions>
        </Dialog>
    );
}
