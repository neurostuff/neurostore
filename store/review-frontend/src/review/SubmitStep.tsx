import { Alert, Box, Button, List, ListItem, ListItemButton, ListItemText, Typography } from '@mui/material';
import { useMemo, useState, type ReactNode } from 'react';
import type { ReviewLifecycle } from '../api/reviewApi';
import { useShallow } from 'zustand/react/shallow';
import { currentAnalyses, parseOf } from '../model/coordinates';
import { visibleItems } from '../model/diff';
import { useOpClient, useSession, useView } from '../store/context';
import { selectDiff, selectOriginalIndex } from '../store/diffSelectors';
import { selectSaveLabel } from '../store/sessionStore';
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

export function SubmitStep() {
    const client = useOpClient();
    const state = useSession((s) => s.bundle.review?.state);
    const saved = useSession((s) => selectSaveLabel(s) === 'saved');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const summary = useSummary();
    const left = count(summary.unreviewed);

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
                        onClick={() => change('submitted')}
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
        </Box>
    );
}
