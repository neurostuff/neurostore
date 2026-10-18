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
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { AnyTarget } from '../contract/generated/review-ops';
import { classWords, inWords, slotLabel } from '../model/labels';
import { canAddEvidence } from '../store/sessionStore';
import type { RecordIndex, SlotNode, SpanPair } from '../model/record';
import { isTextField } from '../review/shortcuts';
import { useReviewStores, useSession, useView } from '../store/context';
import {
    addNote,
    cannotMake,
    createNew,
    danglingLinks,
    deleteEntity,
    link,
    linkCandidates,
    newEntity,
    reject,
    REJECT_REASONS,
    type RejectReason,
    siblingClasses,
} from './actions';
import { panelKeys } from './panelKeys';

export function RejectPanel({ target, label }: { target: AnyTarget; label: string }) {
    const stores = useReviewStores();
    const closePanel = useView((s) => s.closePanel);
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
        if (reject(stores, target, reason, note.trim())) closePanel();
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
    const stores = useReviewStores();
    const closePanel = useView((s) => s.closePanel);
    const id = useId();
    const [note, setNote] = useState('');
    const [error, setError] = useState('');
    const submit = () => {
        if (!note.trim()) return setError('write a note first');
        if (addNote(stores, target, note.trim())) closePanel();
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
            <Stack direction="row" spacing={1}>
                <Button size="small" variant="contained" onClick={submit}>
                    Save note
                </Button>
                <Button size="small" onClick={closePanel}>
                    Cancel
                </Button>
            </Stack>
        </Stack>
    );
}

export function LinkPanel({ slot, label }: { slot: SlotNode; label: string }) {
    const stores = useReviewStores();
    const bundle = useSession((s) => s.bundle);
    const index = useSession((s) => s.index);
    const options = useMemo(() => linkCandidates({ bundle, index }, slot), [bundle, index, slot]);
    return (
        <PickPanel
            options={options}
            label={`link ${label} to`}
            noOptionsText="no entity of this class to link"
            optionKey={(option) => option.id}
            onPick={(option) => link(stores, slot, option.id)}
        />
    );
}

/** The slots `span` of `slot` can move to: the others that take evidence, the slot's own entity's first. */
function evidenceTargets(index: RecordIndex, slot: SlotNode) {
    const own = index.visible.filter((e) => e.id === slot.entity);
    return [...own, ...index.visible.filter((e) => e.id !== slot.entity)].flatMap((entity) =>
        entity.slots
            .filter((other) => other.key !== slot.key && canAddEvidence(other))
            .map((other) => ({ key: other.key, name: `${entity.name} · ${slotLabel(index, other)}` }))
    );
}

/** Picks the slot to move the evidence span `span` of `slot` to, and moves it there in one intent. */
export function MoveEvidencePanel({ slot, span }: { slot: SlotNode; span: SpanPair }) {
    const stores = useReviewStores();
    const index = useSession((s) => s.index);
    const options = useMemo(() => evidenceTargets(index, slot), [index, slot]);
    return (
        <PickPanel
            options={options}
            label="move this evidence to"
            noOptionsText="no other field takes evidence"
            optionKey={(option) => option.key}
            onPick={(option) => stores.session.getState().transferEvidence(slot.key, span, option.key)}
        />
    );
}

/** A list of the options to pick from; picking one runs `onPick`, and closes the panel when it returns true. */
export function PickPanel<T extends { name: string }>({
    options,
    label,
    noOptionsText,
    optionKey,
    onPick,
}: {
    options: T[];
    label: string;
    noOptionsText: string;
    optionKey(option: T): string;
    onPick(option: T): boolean;
}) {
    const closePanel = useView((s) => s.closePanel);
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
                getOptionKey={optionKey}
                isOptionEqualToValue={(option, value) => optionKey(option) === optionKey(value)}
                noOptionsText={noOptionsText}
                onClose={(_, reason) => {
                    if (reason === 'escape') closePanel();
                }}
                onChange={(_, option) => {
                    if (option && onPick(option)) closePanel();
                }}
                renderInput={(params) => <TextField {...params} autoFocus label={label} />}
            />
        </Stack>
    );
}

export function CreateDialog() {
    const stores = useReviewStores();
    const closePanel = useView((s) => s.closePanel);
    const bundle = useSession((s) => s.bundle);
    const record = useSession((s) => s.record);
    const index = useSession((s) => s.index);
    const focused = useView((s) => s.focus.entity);
    const classes = useMemo(() => siblingClasses({ bundle, record }, focused), [bundle, record, focused]);
    const [chosen, setChosen] = useState(classes.length === 1 ? classes[0].name : undefined);
    const [picked, setPicked] = useState<Record<string, string>>({});
    const documents = { bundle, record, index };
    const made = chosen === undefined ? undefined : newEntity(documents, focused, chosen, picked);
    const titleId = useId();
    const asking = made && 'pick' in made ? made.pick : undefined;
    const choose = (name: string) => {
        const next = newEntity(documents, focused, name);
        if ('pick' in next) setChosen(name);
        else if (createNew(stores, next)) closePanel();
    };
    const pick = (name: string, path: string, id: string) => {
        const next = { ...picked, [path]: id };
        const resolved = newEntity(documents, focused, name, next);
        if ('pick' in resolved) setPicked(next);
        return createNew(stores, resolved);
    };
    return (
        <Dialog open onClose={closePanel} aria-labelledby={titleId}>
            <DialogTitle id={titleId}>{asking ? `Which ${inWords(asking.path)}?` : 'Create which kind?'}</DialogTitle>
            <DialogContent>
                {asking && chosen ? (
                    <PickPanel
                        options={asking.candidates}
                        label={`${inWords(asking.path)} of the new ${classWords(chosen)}`}
                        noOptionsText={`no ${inWords(asking.path)} to pick`}
                        optionKey={(option) => option.id}
                        onPick={(option) => pick(chosen, asking.path, option.id)}
                    />
                ) : (
                    <List dense aria-label="kinds">
                        {classes.map(({ name, title }) => {
                            const reason = cannotMake(documents, focused, name);
                            return (
                                <ListItem key={name} disableGutters>
                                    <Button disabled={reason !== undefined} title={reason} onClick={() => choose(name)}>
                                        {title}
                                    </Button>
                                </ListItem>
                            );
                        })}
                    </List>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={closePanel}>Cancel</Button>
            </DialogActions>
        </Dialog>
    );
}

export type Dangling = ReturnType<typeof danglingLinks>[number];

export function DanglingList({ links }: { links: Dangling[] }) {
    const index = useSession((s) => s.index);
    return (
        <>
            <Typography variant="body2">These links would be left dangling:</Typography>
            <List dense aria-label="dangling links">
                {links.map(({ entity: from, slot, target }) => (
                    <ListItem key={`${slot.key}:${target}`} disableGutters>
                        {`${from.name} · ${slotLabel(index, slot)} → ${target}`}
                    </ListItem>
                ))}
            </List>
        </>
    );
}

/** A dialog that runs `onConfirm` on its button and closes when it returns true. */
export function ConfirmDialog({
    title,
    confirmLabel,
    color,
    onConfirm,
    children,
}: {
    title: string;
    confirmLabel: string;
    color?: 'error';
    onConfirm(): boolean;
    children: ReactNode;
}) {
    const closePanel = useView((s) => s.closePanel);
    const titleId = useId();
    return (
        <Dialog open onClose={closePanel} aria-labelledby={titleId}>
            <DialogTitle id={titleId}>{title}</DialogTitle>
            <DialogContent>{children}</DialogContent>
            <DialogActions>
                <Button onClick={closePanel}>Cancel</Button>
                <Button
                    color={color}
                    variant="contained"
                    autoFocus
                    onClick={() => {
                        if (onConfirm()) closePanel();
                    }}
                >
                    {confirmLabel}
                </Button>
            </DialogActions>
        </Dialog>
    );
}

export function DeleteDialog({ entity }: { entity: string }) {
    const stores = useReviewStores();
    const name = useSession((s) => s.index.entity(entity)?.name ?? entity);
    const bundle = useSession((s) => s.bundle);
    const index = useSession((s) => s.index);
    const dangling = useMemo(() => danglingLinks({ bundle, index }, entity), [bundle, index, entity]);
    return (
        <ConfirmDialog
            title={`Delete ${name}?`}
            confirmLabel="Delete"
            color="error"
            onConfirm={() => deleteEntity(stores, entity)}
        >
            {dangling.length === 0 ? (
                <Typography variant="body2">Nothing links to it.</Typography>
            ) : (
                <DanglingList links={dangling} />
            )}
            <Typography variant="caption" color="text.secondary">
                The server applies the delete and reports every link it leaves.
            </Typography>
        </ConfirmDialog>
    );
}
