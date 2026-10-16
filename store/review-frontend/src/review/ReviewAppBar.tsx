import { AppBar, Button, Chip, Toolbar, Typography } from '@mui/material';
import { Brand } from '../Brand';
import { editSummary } from '../format/editSummary';
import { displayName } from '../format/people';
import { useReviewStore } from '../store/context';
import { selectIsBlocked, selectSaveLabel, type ReviewState } from '../store/reviewStore';

const STATES = {
    in_progress: 'in progress',
    submitted: 'submitted',
    reference: 'reference',
    set_aside: 'set aside',
} as const;

function selectProgress(s: ReviewState): string {
    const slots = s.index.unhidden.flatMap((e) => e.slots);
    const reviewed = slots.filter((slot) => slot.key in s.provenance).length;
    const analyses = s.bundle.hidden.analyses.length;
    return `${reviewed} of ${slots.length} reviewed, plus ${analyses} non-coordinate ${analyses === 1 ? 'analysis' : 'analyses'}`;
}

export function ReviewAppBar() {
    const label = useReviewStore((s) => s.bundle.source.label);
    const state = useReviewStore((s) => (s.bundle.review ? STATES[s.bundle.review.state] : 'new review'));
    const progress = useReviewStore(selectProgress);
    const showing = useReviewStore((s) => s.showNonCoordinate);
    const toggleNonCoordinate = useReviewStore((s) => s.toggleNonCoordinate);
    const saved = useReviewStore(selectSaveLabel);
    const blocked = useReviewStore(selectIsBlocked);
    const reviewers = useReviewStore((s) => s.bundle.reviewers);
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
                <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>
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
                <Button
                    size="small"
                    color="inherit"
                    variant="outlined"
                    aria-pressed={showing}
                    title="Shift+H"
                    sx={{ whiteSpace: 'nowrap' }}
                    onClick={() => toggleNonCoordinate()}
                >
                    non-coordinate analyses
                </Button>
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
