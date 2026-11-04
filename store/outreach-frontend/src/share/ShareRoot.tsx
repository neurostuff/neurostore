import { Alert, Box, CircularProgress, Container, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { ShareError, tokenFrom, type ShareApi } from './api';
import { SharePage } from './SharePage';
import type { ShareView } from './types';

/** Reads the link's token from the URL's fragment, trades it for a cookie, and takes the
 * token out of the address bar. A return visit without the fragment uses the cookie, and
 * a new link opened in the same tab starts over with its own token. */
export function ShareRoot({ api }: { api: ShareApi }) {
    const [view, setView] = useState<ShareView | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let live = true;
        const token = tokenFrom(window.location.hash);
        const load = token ? api.session(token) : api.draft();
        load.then(
            (next) => {
                if (!live) return;
                if (token) window.history.replaceState(null, '', window.location.pathname);
                setView(next);
            },
            (failure: unknown) => {
                if (!live) return;
                setError(
                    failure instanceof ShareError && failure.status === 401
                        ? 'This link has expired or no longer works. Reply to the email you got and we will send a new one.'
                        : 'Something went wrong loading this page. Please try again in a moment.'
                );
            }
        );
        // Another paper's link opened in this tab changes only the fragment, which loads
        // nothing: reload, so its token is traded for this page's cookie.
        const switched = () => tokenFrom(window.location.hash) && window.location.reload();
        window.addEventListener('hashchange', switched);
        return () => {
            live = false;
            window.removeEventListener('hashchange', switched);
        };
    }, [api]);

    return (
        <Container maxWidth="md" sx={{ py: 4 }}>
            <Typography variant="overline" color="primary">
                Neurosynth · NeuroVault
            </Typography>
            {error && <Alert severity="warning">{error}</Alert>}
            {!error && !view && (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
                    <CircularProgress />
                </Box>
            )}
            {view && <SharePage api={api} initial={view} />}
        </Container>
    );
}
