import { Auth0Provider, useAuth0 } from '@auth0/auth0-react';
import { Alert, Box, Button, CircularProgress, CssBaseline, Stack, TextField, ThemeProvider, Typography } from '@mui/material';
import { createTheme } from '@mui/material/styles';
import { themeOptions } from '@neurosynth/theme';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ApiError, outreachApi, type Authorize } from './api';
import { App } from './App';

export interface Env {
    BASE_URL: string;
    [name: string]: string | boolean | undefined;
}

const text = (env: Env, name: string) => String(env[name] ?? '');
const theme = createTheme(themeOptions);
const DEV_PASSWORD_KEY = 'outreach-dev-password';

function Centered({ children }: { children: ReactNode }) {
    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, p: 6 }}>{children}</Box>
    );
}

/** Checks the session against the API before showing the panel: signed in is not enough,
 * the account has to be an outreach admin. */
function Admitted({ apiBase, authorize, onDenied }: { apiBase: string; authorize: Authorize; onDenied: () => void }) {
    const api = useMemo(() => outreachApi(apiBase, authorize), [apiBase, authorize]);
    const [state, setState] = useState<'checking' | 'in' | string>('checking');
    useEffect(() => {
        let live = true;
        api.me().then(
            () => live && setState('in'),
            (error: unknown) => {
                if (!live) return;
                if (error instanceof ApiError && error.status === 401) onDenied();
                setState(error instanceof Error ? error.message : 'Could not reach the outreach API.');
            }
        );
        return () => {
            live = false;
        };
    }, [api, onDenied]);
    if (state === 'checking')
        return (
            <Centered>
                <CircularProgress />
            </Centered>
        );
    if (state !== 'in')
        return (
            <Centered>
                <Alert severity="error">{state}</Alert>
            </Centered>
        );
    return <App api={api} />;
}

function readStored(): string | null {
    try {
        return sessionStorage.getItem(DEV_PASSWORD_KEY);
    } catch {
        return null;
    }
}

function store(password: string | null) {
    try {
        if (password === null) sessionStorage.removeItem(DEV_PASSWORD_KEY);
        else sessionStorage.setItem(DEV_PASSWORD_KEY, password);
    } catch {
        // Private windows can refuse storage; the password then lasts until a reload.
    }
}

/** Development only: the backend's OUTREACH_DEV_PASSWORD, sent as HTTP basic auth. */
function DevSignIn({ apiBase }: { apiBase: string }) {
    const [password, setPassword] = useState<string | null>(readStored);
    const [typed, setTyped] = useState('');
    const authorize = useMemo<Authorize>(() => async () => (password ? `Basic ${btoa(`dev:${password}`)}` : null), [password]);
    const signOut = useMemo(
        () => () => {
            store(null);
            setPassword(null);
        },
        []
    );
    if (password) return <Admitted apiBase={apiBase} authorize={authorize} onDenied={signOut} />;
    return (
        <Centered>
            <Typography variant="h5" component="h1">
                neurostore outreach (development)
            </Typography>
            <Stack
                component="form"
                direction="row"
                spacing={1}
                onSubmit={(event) => {
                    event.preventDefault();
                    store(typed);
                    setPassword(typed);
                }}
            >
                <TextField
                    size="small"
                    type="password"
                    label="Dev password"
                    value={typed}
                    onChange={(event) => setTyped(event.target.value)}
                />
                <Button type="submit" variant="contained">
                    Sign in
                </Button>
            </Stack>
        </Centered>
    );
}

function Auth0Admitted({ apiBase }: { apiBase: string }) {
    const { isLoading, isAuthenticated, loginWithRedirect, getAccessTokenSilently, logout } = useAuth0();
    const authorize = useMemo<Authorize>(
        () => async () => `Bearer ${await getAccessTokenSilently()}`,
        [getAccessTokenSilently]
    );
    const signOut = useMemo(() => () => void logout({ logoutParams: { returnTo: window.location.origin } }), [logout]);
    if (isLoading)
        return (
            <Centered>
                <CircularProgress />
            </Centered>
        );
    if (!isAuthenticated)
        return (
            <Centered>
                <Typography variant="h5" component="h1">
                    Sign in to neurostore outreach
                </Typography>
                <Button variant="contained" onClick={() => loginWithRedirect()}>
                    Sign in
                </Button>
            </Centered>
        );
    return <Admitted apiBase={apiBase} authorize={authorize} onDenied={signOut} />;
}

export function Root({ env }: { env: Env }) {
    const apiBase = text(env, 'VITE_APP_NEUROSTORE_API_DOMAIN');
    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            {text(env, 'VITE_APP_OUTREACH_DEV_LOGIN') === '1' ? (
                <DevSignIn apiBase={apiBase} />
            ) : (
                <Auth0Provider
                    domain={text(env, 'VITE_APP_AUTH0_DOMAIN')}
                    clientId={text(env, 'VITE_APP_AUTH0_CLIENT_ID')}
                    useRefreshTokens={true}
                    cacheLocation="localstorage"
                    authorizationParams={{
                        redirect_uri: `${window.location.origin}${env.BASE_URL}`,
                        audience: text(env, 'VITE_APP_AUTH0_AUDIENCE'),
                        scope: 'openid profile email offline_access',
                    }}
                >
                    <Auth0Admitted apiBase={apiBase} />
                </Auth0Provider>
            )}
        </ThemeProvider>
    );
}
