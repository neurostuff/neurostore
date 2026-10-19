import { Alert, Button, Stack, Typography } from '@mui/material';
import { useMemo } from 'react';
import { currentAnalyses, type CoordinateAnalysis } from '../model/coordinates';
import { useIsEditable, useSession } from '../store/context';
import { collectedByAnalysis, pendingKeys } from '../store/pointEdits';

const editsText = (count: number) => `${count} point ${count === 1 ? 'edit' : 'edits'}`;

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

/** The point edits kept because their analysis was replaced before they were sent, each to apply to a guess or discard. */
export function StrandedEdits() {
    const collected = useSession((s) => s.collected);
    const bundle = useSession((s) => s.bundle);
    const discard = useSession((s) => s.discardCollected);
    const apply = useSession((s) => s.applyCollected);
    const editable = useIsEditable();
    const analyses = currentAnalyses(bundle);
    const stranded = useMemo(() => {
        const known = new Set(analyses.map((analysis) => analysis.key));
        return collectedByAnalysis(collected)
            .filter((edit) => !known.has(edit.key))
            .map((edit) => ({ edit, count: collected.filter((entry) => entry.key === edit.key).length }));
    }, [collected, analyses]);
    if (!stranded.length) return null;
    return (
        <Stack spacing={0.5} sx={{ pt: 1 }}>
            {stranded.map(({ edit, count }) => {
                const guess = analyses.find((analysis) => analysis.key === edit.held?.guess);
                return (
                    <Alert
                        key={edit.key}
                        role="note"
                        severity="warning"
                        aria-label={`kept point edits on ${edit.name}`}
                    >
                        {`${editsText(count)} on ${edit.name} kept, not sent: ${edit.held?.message ?? ''}`}
                        {guess && (
                            <Button size="small" disabled={!editable} onClick={() => apply(edit.key, guess.key)}>
                                {`Apply to ${guess.name}`}
                            </Button>
                        )}
                        <Button size="small" disabled={!editable} onClick={() => discard(edit.key)}>
                            Discard
                        </Button>
                    </Alert>
                );
            })}
        </Stack>
    );
}
