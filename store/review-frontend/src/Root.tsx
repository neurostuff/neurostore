import { Auth0Provider, useAuth0, type AppState } from '@auth0/auth0-react';
import { Box, Button, CssBaseline, ThemeProvider, Typography } from '@mui/material';
import { useMemo } from 'react';
import { fixtureApi } from './api/fixtureApi';
import { httpApi } from './api/httpApi';
import { App } from './App';
import { Loading } from './Loading';
import { theme } from './theme';

export interface Env {
    BASE_URL: string;
    [name: string]: string | boolean | undefined;
}

const text = (env: Env, name: string) => String(env[name] ?? '');

function SignIn({ onSignIn }: { onSignIn: () => void }) {
    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, p: 6 }}>
            <Typography variant="h5" component="h1">
                Sign in to neurostore review
            </Typography>
            <Button variant="contained" onClick={onSignIn}>
                Sign in
            </Button>
        </Box>
    );
}

function SignedInApp({ apiBase }: { apiBase: string }) {
    const { isLoading, isAuthenticated, loginWithRedirect, getAccessTokenSilently } = useAuth0();
    const api = useMemo(() => httpApi(apiBase, () => getAccessTokenSilently()), [apiBase, getAccessTokenSilently]);
    if (isLoading) return <Loading />;
    if (!isAuthenticated)
        return <SignIn onSignIn={() => loginWithRedirect({ appState: { returnTo: window.location.pathname } })} />;
    return <App api={api} />;
}

const returnTo = (appState?: AppState) =>
    window.history.replaceState(null, '', appState?.returnTo ?? window.location.pathname);

function SignedIn({ env }: { env: Env }) {
    return (
        <Auth0Provider
            domain={text(env, 'VITE_APP_AUTH0_DOMAIN')}
            clientId={text(env, 'VITE_APP_AUTH0_CLIENT_ID')}
            useRefreshTokens={true}
            cacheLocation="localstorage"
            onRedirectCallback={returnTo}
            authorizationParams={{
                redirect_uri: `${window.location.origin}${env.BASE_URL}`,
                audience: text(env, 'VITE_APP_AUTH0_AUDIENCE'),
                scope: 'openid profile email offline_access',
            }}
        >
            <SignedInApp apiBase={text(env, 'VITE_APP_NEUROSTORE_API_DOMAIN')} />
        </Auth0Provider>
    );
}

export function Root({ env }: { env: Env }) {
    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            {text(env, 'VITE_APP_REVIEW_FIXTURES') === '1' ? (
                <App api={fixtureApi(env.BASE_URL)} />
            ) : (
                <SignedIn env={env} />
            )}
        </ThemeProvider>
    );
}
