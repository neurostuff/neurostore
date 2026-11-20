import {
    Alert,
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Link,
    List,
    ListItem,
    ListItemButton,
    ListItemText,
    Typography,
} from '@mui/material';
import { useId, useMemo, useState, type ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { STEPS } from '../model/steps';
import type { ReviewLifecycle } from '../api/reviewApi';
import { useShallow } from 'zustand/react/shallow';
import { currentAnalyses, parseOf } from '../model/coordinates';
import { visibleItems } from '../model/diff';
import { useOpClient, useSession, useView } from '../store/context';
import { selectDiff, selectOriginalIndex } from '../store/diffSelectors';
import { selectSaveLabel } from '../store/sessionStore';
import { useStartFocus } from './startFocus';
import {
    changeGroups,
    openNotes,
    targetLabeller,
    unreviewedGroups,
    type SummaryGroup,
    type SummaryItem,
} from './summary';

const count = (groups: SummaryGroup[]) => groups.reduce((n, group) => n + group.items.length, 0);

function SummaryLine({ item, secondary }: { item: SummaryItem; secondary?: string }) {
    const focusTarget = useView((s) => s.focusTarget);
    const { target } = item;
    const text = <ListItemText primary={item.label} secondary={secondary} />;
    return (
        <ListItem disablePadding>
            {target ? (
                <ListItemButton onClick={() => focusTarget(target)}>{text}</ListItemButton>
            ) : (
                <Box sx={{ px: 2 }}>{text}</Box>
            )}
        </ListItem>
    );
}

function Section({ label, title, children }: { label: string; title: string; children: ReactNode }) {
    return (
        <Box component="section" aria-label={label} sx={{ minWidth: 220, flex: '1 1 0' }}>
            <Typography variant="subtitle2" component="h3">
                {title}
            </Typography>
            {children}
        </Box>
    );
}

function Groups({ groups }: { groups: SummaryGroup[] }) {
    return groups.map((group) => (
        <Box key={group.label}>
            <Typography variant="overline" component="h4">{`${group.label} (${group.items.length})`}</Typography>
            <List dense disablePadding>
                {group.items.map((item) => (
                    <SummaryLine key={item.key} item={item} />
                ))}
            </List>
        </Box>
    ));
}

/** The summary's three parts, from the review as it is now. */
function useSummary() {
    const diff = useSession(selectDiff);
    const original = useSession(selectOriginalIndex);
    const documents = useSession(useShallow((s) => ({ index: s.index, bundle: s.bundle, provenance: s.provenance })));
    const showNonCoordinate = useView((s) => s.showNonCoordinate);
    const state = useMemo(() => ({ ...documents, showNonCoordinate }), [documents, showNonCoordinate]);
    const ops = useSession((s) => s.ops);
    const pending = useSession((s) => s.pending);
    const label = useMemo(() => {
        const { parse } = parseOf(state.bundle);
        return targetLabeller(state.index, original, [...(parse.analyses ?? []), ...currentAnalyses(state.bundle)]);
    }, [state.index, original, state.bundle]);
    const changes = useMemo(
        () => changeGroups(visibleItems(diff, state.showNonCoordinate), label),
        [diff, state.showNonCoordinate, label]
    );
    const notes = useMemo(() => openNotes([...ops.map((s) => s.op), ...pending], label), [ops, pending, label]);
    const unreviewed = useMemo(() => unreviewedGroups(state, label), [state, label]);
    return { changes, notes, unreviewed };
}

/** What changed, the open notes and what is still unreviewed. */
function SubmitSummary({ changes, notes, unreviewed }: ReturnType<typeof useSummary>) {
    return (
        <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', maxHeight: '40vh', overflow: 'auto' }}>
            <Section label="what changed" title={`what changed (${count(changes)})`}>
                {changes.length ? (
                    <Groups groups={changes} />
                ) : (
                    <Typography variant="body2">Nothing changed.</Typography>
                )}
            </Section>
            <Section label="open notes" title={`open notes (${notes.length})`}>
                <List dense disablePadding>
                    {notes.map((note) => (
                        <SummaryLine key={note.key} item={note} secondary={note.note} />
                    ))}
                </List>
            </Section>
            <Section label="unreviewed" title={`unreviewed (${count(unreviewed)})`}>
                <Groups groups={unreviewed} />
            </Section>
        </Box>
    );
}

const unreviewedText = (left: number) =>
    left === 1 ? '1 item is still unreviewed.' : `${left} items are still unreviewed.`;

/** Asks before a review is submitted with items left; reviewing them is the default. */
function ConfirmSubmit({
    unreviewed,
    onSubmit,
    onClose,
}: {
    unreviewed: SummaryGroup[];
    onSubmit(): void;
    onClose(): void;
}) {
    const titleId = useId();
    const setStep = useView((s) => s.setStep);
    const focusTarget = useView((s) => s.focusTarget);
    const left = count(unreviewed);
    const reviewFirst = useStartFocus<HTMLButtonElement>();
    const reviewThem = () => {
        onClose();
        const [first] = unreviewed;
        const step = STEPS.find((s) => s.label === first?.label);
        if (step) setStep(step.id);
        const target = first?.items[0]?.target;
        if (target) focusTarget(target);
    };
    return (
        <Dialog open onClose={onClose} aria-labelledby={titleId}>
            <DialogTitle id={titleId}>{`Submit with ${left} ${left === 1 ? 'item' : 'items'} unreviewed?`}</DialogTitle>
            <DialogContent>
                <List dense aria-label="still unreviewed">
                    {unreviewed.map((group) => (
                        <ListItem key={group.label} disableGutters>
                            {`${group.label}: ${group.items.length}`}
                        </ListItem>
                    ))}
                </List>
                <Typography variant="body2" color="text.secondary">
                    Unreviewed items are sent as the model read them.
                </Typography>
            </DialogContent>
            <DialogActions>
                <Button onClick={onSubmit}>Submit anyway</Button>
                <Button ref={reviewFirst} variant="contained" onClick={reviewThem}>
                    Review them
                </Button>
            </DialogActions>
        </Dialog>
    );
}

/** What a submitted review is, and where to go next. */
function Submitted() {
    return (
        <Alert role="status" aria-label="review submitted" severity="success" sx={{ mb: 1.5 }}>
            <strong>Review submitted.</strong> It is kept as you left it; a lead can mark it the reference. Reopen it to
            change anything.{' '}
            <Link component={RouterLink} to="/">
                Back to the papers
            </Link>
        </Alert>
    );
}

export function SubmitStep() {
    const client = useOpClient();
    const state = useSession((s) => s.bundle.review?.state);
    const saved = useSession((s) => selectSaveLabel(s) === 'saved');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const summary = useSummary();
    const left = count(summary.unreviewed);
    const [confirming, setConfirming] = useState(false);

    const change = (next: ReviewLifecycle) => {
        setBusy(true);
        setError(null);
        client
            .changeState(next)
            .catch((e: Error) => setError(e.message))
            .finally(() => setBusy(false));
    };

    return (
        <Box sx={{ px: 3, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
            {state === 'submitted' && <Submitted />}
            <SubmitSummary {...summary} />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, pt: 1.5 }}>
                {state === 'submitted' ? (
                    <Button variant="outlined" disabled={busy} onClick={() => change('in_progress')}>
                        Reopen review
                    </Button>
                ) : (
                    <Button
                        variant="contained"
                        disabled={busy || !saved || state !== 'in_progress'}
                        onClick={() => (left > 0 ? setConfirming(true) : change('submitted'))}
                    >
                        Submit review
                    </Button>
                )}
                {left > 0 && (
                    <Typography variant="body2" color="text.secondary">
                        {unreviewedText(left)}
                    </Typography>
                )}
                {error && (
                    <Alert severity="error" sx={{ py: 0 }}>
                        {error}
                    </Alert>
                )}
            </Box>
            {confirming && (
                <ConfirmSubmit
                    unreviewed={summary.unreviewed}
                    onClose={() => setConfirming(false)}
                    onSubmit={() => {
                        setConfirming(false);
                        change('submitted');
                    }}
                />
            )}
        </Box>
    );
}
