import { Alert, Box, Button } from '@mui/material';
import { useState } from 'react';
import type { ReviewLifecycle } from '../api/reviewApi';
import { useOpClient, useReviewStore } from '../store/context';
import { selectSaveLabel } from '../store/reviewStore';

export function SubmitStep() {
    const client = useOpClient();
    const state = useReviewStore((s) => s.bundle.review?.state);
    const saved = useReviewStore((s) => selectSaveLabel(s) === 'saved');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const change = (next: ReviewLifecycle) => {
        setBusy(true);
        setError(null);
        client
            .changeState(next)
            .catch((e: Error) => setError(e.message))
            .finally(() => setBusy(false));
    };

    return (
        <Box
            sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                px: 3,
                py: 1.5,
                borderBottom: 1,
                borderColor: 'divider',
            }}
        >
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
            {error && (
                <Alert severity="error" sx={{ py: 0 }}>
                    {error}
                </Alert>
            )}
        </Box>
    );
}
