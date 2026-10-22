import { Stack, Typography } from '@mui/material';
import { isLinkStep } from '../model/guided';
import { selectStepProgress } from '../review/stepCount';
import { useSession, useView } from '../store/context';

/** The way on from a judged card or analysis while its step is not done: the step's next one no one has judged. */
export function NextCard() {
    const step = useView((s) => s.step);
    const focusNextUnjudged = useView((s) => s.focusNextUnjudged);
    const complete = useSession((s) => selectStepProgress(s, step).complete);
    if (complete) return null;
    const [one, many] =
        step === 'coordinates' || step === 'analyses' || isLinkStep(step)
            ? ['analysis', 'analyses']
            : ['card', 'cards'];
    return (
        <button
            type="button"
            className="rv-quick"
            title={`Open the step’s next ${one} no one has judged (Shift+J and Shift+K move between ${many})`}
            onClick={focusNextUnjudged}
        >
            {`Next ${one}`}
        </button>
    );
}

/** What the last verdict did, `text`, announced as it changes, and while there is one the way on. */
export function VerdictStatus({ text }: { text: string }) {
    return (
        <Stack direction="row" spacing={1} alignItems="center">
            <Typography role="status" aria-label="last verdict" variant="body2" color="text.secondary" component="div">
                {text}
            </Typography>
            {text && <NextCard />}
        </Stack>
    );
}
