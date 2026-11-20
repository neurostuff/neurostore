import CloseIcon from '@mui/icons-material/Close';
import { Box, Button, IconButton, Typography } from '@mui/material';
import { useState } from 'react';
import { STEPS } from '../model/steps';
import { useSession, useView } from '../store/context';
import { readDismissed, writeDismissed } from './dismissedHints';
import { Hint } from './Hint';
import { selectStepProgress } from './stepCount';

/** Once every item of the step is judged, the way on to the next step. */
function NextStep() {
    const step = useView((s) => s.step);
    const moveStep = useView((s) => s.moveStep);
    const done = useSession((s) => selectStepProgress(s, step).complete);
    const next = STEPS[STEPS.findIndex((s) => s.id === step) + 1];
    if (!done || !next) return null;
    return (
        <Hint title={`Go on to ${next.label} (Alt+Shift+J)`}>
            <Button size="small" variant="contained" onClick={() => moveStep(1)} sx={{ flexShrink: 0 }}>
                {`Next: ${next.label} →`}
            </Button>
        </Hint>
    );
}

/** One line saying what the step is for, until the reviewer dismisses it for that step. */
function StepHint() {
    const step = useView((s) => s.step);
    const [dismissed, setDismissed] = useState(readDismissed);
    if (dismissed.includes(step)) return <Box sx={{ flex: 1 }} />;
    const dismiss = () => {
        const next = [...dismissed, step];
        writeDismissed(next);
        setDismissed(next);
    };
    return (
        <Box
            role="note"
            aria-label="what this step is for"
            sx={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
            <Typography variant="body2" color="text.secondary" noWrap title={STEPS.find((s) => s.id === step)?.hint}>
                {STEPS.find((s) => s.id === step)?.hint}
            </Typography>
            <Hint title="Hide this hint for this step">
                <IconButton size="small" aria-label="dismiss" onClick={dismiss}>
                    <CloseIcon fontSize="inherit" />
                </IconButton>
            </Hint>
        </Box>
    );
}

/** Under the step bar: what the step is for, and the way on once it is done. */
export function StepGuide() {
    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 3, py: 0.5, minHeight: 36 }}>
            <StepHint />
            <NextStep />
        </Box>
    );
}
