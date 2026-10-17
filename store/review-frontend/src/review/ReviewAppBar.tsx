import { AppBar, Button, Chip, Toolbar, Typography } from '@mui/material';
import { Brand } from '../Brand';
import { editSummary } from '../format/editSummary';
import { displayName } from '../format/people';
import { useSession, useView } from '../store/context';
import { selectIsBlocked, selectSaveLabel, type SessionState } from '../store/sessionStore';

const STATES = {
    in_progress: 'in progress',
    submitted: 'submitted',
    reference: 'reference',
    set_aside: 'set aside',
} as const;

const PROGRESS_MEANS =
    'Slots of the record you have accepted, rejected or edited; analyses with no coordinates are counted apart';

const toggleMeans = (count: number) =>
    count === 0
        ? 'This paper has no analyses without coordinates; when one has, this shows or hides them (Shift+H)'
        : `Show or hide the ${count} ${count === 1 ? 'analysis' : 'analyses'} with no coordinates, on the Coordinates and Analyses steps (Shift+H)`;

function selectProgress(s: Pick<SessionState, 'index' | 'provenance' | 'bundle'>): string {
    const slots = s.index.unhidden.flatMap((e) => e.slots);
    const reviewed = slots.filter((slot) => slot.key in s.provenance).length;
    const analyses = s.bundle.hidden.analyses.length;
    return `${reviewed} of ${slots.length} reviewed, plus ${analyses} non-coordinate ${analyses === 1 ? 'analysis' : 'analyses'}`;
}

export function ReviewAppBar() {
    const label = useSession((s) => s.bundle.source.label);
    const state = useSession((s) => (s.bundle.review ? STATES[s.bundle.review.state] : 'new review'));
    const progress = useSession(selectProgress);
    const showing = useView((s) => s.showNonCoordinate);
    const nonCoordinate = useSession((s) => s.bundle.hidden.analyses.length);
    const toggleNonCoordinate = useView((s) => s.toggleNonCoordinate);
    const saved = useSession(selectSaveLabel);
    const blocked = useSession(selectIsBlocked);
    const reviewers = useSession((s) => s.bundle.reviewers);
    const now = new Date();
    return (
        <AppBar position="static" elevation={0}>
            <Toolbar variant="dense" sx={{ gap: 2 }}>
                <Brand />
                <Typography variant="body1" noWrap sx={{ flex: 1, minWidth: 0 }} title={label}>
                    {label}
                </Typography>
                <Chip
                    size="small"
                    label={state}
                    title="review state"
                    aria-label={`review state: ${state}`}
                    sx={{ color: 'inherit', borderColor: 'currentColor' }}
                    variant="outlined"
                />
                <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }} title={PROGRESS_MEANS}>
                    {progress}
                </Typography>
                {reviewers.map((editor) =>
                    editor.op_count > 0 && editor.last_edit_at ? (
                        <Typography
                            key={editor.user_id}
                            variant="body2"
                            sx={{ whiteSpace: 'nowrap' }}
                            title={new Date(editor.last_edit_at).toLocaleString()}
                        >
                            {`${displayName(editor)}: ${editSummary(editor.op_count, editor.last_edit_at, now)}`}
                        </Typography>
                    ) : null
                )}
                <span title={toggleMeans(nonCoordinate)}>
                    <Button
                        size="small"
                        color="inherit"
                        variant={showing ? 'contained' : 'outlined'}
                        aria-pressed={showing}
                        disabled={nonCoordinate === 0}
                        sx={{ whiteSpace: 'nowrap', '&.Mui-disabled': { color: 'inherit', opacity: 0.5 } }}
                        onClick={() => toggleNonCoordinate()}
                    >
                        non-coordinate analyses
                    </Button>
                </span>
                <Typography
                    variant="body2"
                    color={blocked ? 'error' : undefined}
                    sx={{ whiteSpace: 'nowrap' }}
                    aria-label={`save state: ${saved}`}
                >
                    {saved}
                </Typography>
            </Toolbar>
        </AppBar>
    );
}
