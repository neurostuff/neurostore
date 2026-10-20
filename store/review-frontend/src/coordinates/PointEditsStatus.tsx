import { Alert, Button, Stack, Typography } from '@mui/material';
import { useMemo } from 'react';
import { currentAnalyses, type CoordinateAnalysis } from '../model/coordinates';
import { useIsEditable, useSession } from '../store/context';
import { pendingKeys } from '../store/pointEdits';
import { heldId, heldOnto, heldPhrase, type HeldOp } from '../store/queuedWork';

/** Whether the analysis's point edits are collected and not yet sent, saving, or saved; held ones say why, with Discard. */
export function PointEditsSaved({ analysis }: { analysis: CoordinateAnalysis }) {
    const collected = useSession((s) => s.collected);
    const saving = useSession((s) => pendingKeys(s).has(analysis.key));
    const discard = useSession((s) => s.discardCollected);
    const editable = useIsEditable();
    const own = useMemo(() => collected.filter((edit) => edit.key === analysis.key), [collected, analysis.key]);
    const held = own.at(-1)?.held;
    const state = own.length ? 'unsaved' : saving ? 'saving…' : 'saved';
    return (
        <>
            <Typography role="status" aria-label="point edits" variant="caption" color="text.secondary">
                {held ? `not saved: ${held.message}` : state}
            </Typography>
            {held && (
                <Button size="small" disabled={!editable} onClick={() => discard(analysis.key)}>
                    Discard my point edits
                </Button>
            )}
        </>
    );
}

const capitalized = (text: string) => `${text[0].toUpperCase()}${text.slice(1)}`;

/** One piece of the reviewer's work kept unsent: why, Apply to the guess (disabled, with why, where it cannot work) and Discard. */
function KeptAlert({ held }: { held: HeldOp }) {
    const analyses = useSession((s) => currentAnalyses(s.bundle));
    const pending = useSession((s) => s.pending);
    const apply = useSession((s) => s.applyHeldOp);
    const discard = useSession((s) => s.discardHeldOp);
    const editable = useIsEditable();
    const phrase = heldPhrase(held);
    const id = heldId(held);
    const guess = analyses.find((analysis) => analysis.key === held.kept.guess);
    const placed = useMemo(
        () => guess && heldOnto(held, guess.key, analyses, pending),
        [guess, held, analyses, pending]
    );
    const reason = placed && 'reason' in placed ? placed.reason : '';
    return (
        <Alert role="note" severity="warning" aria-label={`kept ${phrase}`}>
            {`${capitalized(phrase)} kept, not sent: ${held.kept.message}`}
            {guess && (
                <Button size="small" disabled={!editable || reason !== ''} onClick={() => apply(id, guess.key)}>
                    {`Apply to ${guess.name}`}
                </Button>
            )}
            <Button size="small" disabled={!editable} onClick={() => discard(id)}>
                Discard
            </Button>
            {reason && (
                <Typography variant="caption" component="div">
                    {`Apply cannot work: ${reason}`}
                </Typography>
            )}
        </Alert>
    );
}

/** The reviewer's work kept unsent, each piece to apply to a guess or discard. */
export function KeptWork() {
    const held = useSession((s) => s.heldOps);
    if (!held.length) return null;
    return (
        <Stack spacing={0.5} sx={{ pt: 1 }}>
            {held.map((work) => (
                <KeptAlert key={heldId(work)} held={work} />
            ))}
        </Stack>
    );
}
