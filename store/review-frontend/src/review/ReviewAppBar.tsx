import { AppBar, Chip, Toolbar, Typography } from '@mui/material';
import { Brand } from '../Brand';
import { useReviewStore } from '../store/context';
import { selectIsBlocked, selectSaveLabel, type ReviewState } from '../store/reviewStore';

const STATES = { in_progress: 'in progress', submitted: 'submitted', reference: 'reference' } as const;

function selectProgress(s: ReviewState): string {
    const slots = s.index.visible.flatMap((e) => e.slots);
    const reviewed = slots.filter((slot) => slot.key in s.provenance).length;
    return `${reviewed} of ${slots.length} reviewed`;
}

export function ReviewAppBar() {
    const label = useReviewStore((s) => s.bundle.source.label);
    const state = useReviewStore((s) => (s.bundle.review ? STATES[s.bundle.review.state] : 'new review'));
    const progress = useReviewStore(selectProgress);
    const saved = useReviewStore(selectSaveLabel);
    const blocked = useReviewStore(selectIsBlocked);
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
