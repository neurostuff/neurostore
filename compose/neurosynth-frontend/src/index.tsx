import { Auth0Provider } from '@auth0/auth0-react';
import { grey } from '@mui/material/colors';
import { createTheme, responsiveFontSizes, ThemeProvider } from '@mui/material/styles';
import { SystemStyleObject } from '@mui/system';
import * as Sentry from '@sentry/react';
import React from 'react';
import ReactDOM from 'react-dom';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { QueryCache, QueryClient, QueryClientProvider } from 'react-query';
import { AxiosError } from 'axios';
import { HelmetProvider } from 'react-helmet-async';

export type Style = Record<string, SystemStyleObject>;
export type ColorOptions = 'inherit' | 'primary' | 'secondary' | 'success' | 'error' | 'info' | 'warning';

declare module '@mui/material/styles/createPalette' {
    interface Palette {
        muted: Palette['primary'];
    }
    interface PaletteOptions {
        muted: PaletteOptions['primary'];
    }
}

let theme = createTheme({
    palette: {
        primary: {
            light: '#0096c7',
            main: '#0077b6',
            dark: '#023e8a',
            contrastText: '#ffffff',
        },
        secondary: {
            light: '#f2a354',
            main: '#ef8a24',
            dark: '#e47a11',
            contrastText: '#ffffff',
        },
        error: {
            main: '#ff6b6b',
            contrastText: '#ffffff',
        },
        warning: {
            main: '#dfc23a',
            dark: '#bfa73f',
            contrastText: '#ffffff',
        },
        success: {
            main: '#4caf50',
            contrastText: '#ffffff',
        },
        muted: {
            main: grey[500],
        },
    },
    typography: {
        h1: { fontSize: '3rem' },
        h2: { fontSize: '2.25rem' },
        h3: { fontSize: '1.75rem' },
        h4: { fontSize: '1.5rem' },
        h5: { fontSize: '1.25rem' },
        h6: { fontSize: '1rem' },
        body1: { fontSize: '1rem' },
        body2: { fontSize: '0.875rem' },
    },
});

theme = responsiveFontSizes(theme);

const domain = import.meta.env.VITE_APP_AUTH0_DOMAIN as string;
const clientId = import.meta.env.VITE_APP_AUTH0_CLIENT_ID as string;
const audience = import.meta.env.VITE_APP_AUTH0_AUDIENCE as string;
const env = import.meta.env.VITE_APP_ENV as 'DEV' | 'STAGING' | 'PROD';

if (env === 'PROD') {
    Sentry.init({
        dsn: 'https://348a42291ed44c3baf7e2d94a0dfc08f@o4505036784992256.ingest.sentry.io/4505036786040832',
        integrations: [
            Sentry.browserTracingIntegration(),
            Sentry.replayIntegration({
                maskAllText: false,
                blockAllMedia: false,
                maskAllInputs: false,
            }),
        ],
        replaysSessionSampleRate: 0.1,
        replaysOnErrorSampleRate: 1.0,
    });
}

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: 0,
            refetchOnWindowFocus: false,
            // staleTime: 5000, // https://tkdodo.eu/blog/practical-react-query#the-defaults-explained
        },
    },
    queryCache: new QueryCache({
        onError: (error) => {
            console.log({ error });
            const responseStatus = (error as AxiosError)?.response?.status;
            if (responseStatus && responseStatus === 404) {
                console.error('could not find resource');
            }
        },
    }),
});

ReactDOM.render(
    <React.StrictMode>
        <Auth0Provider
            domain={domain}
            useRefreshTokens={true}
            clientId={clientId}
            redirectUri={window.location.origin}
            scope="openid profile email offline_access"
            audience={audience}
            cacheLocation="localstorage"
        >
            <BrowserRouter>
                <ThemeProvider theme={theme}>
                    <QueryClientProvider client={queryClient}>
                        <HelmetProvider>
                            <App />
                        </HelmetProvider>
                    </QueryClientProvider>
                </ThemeProvider>
            </BrowserRouter>
        </Auth0Provider>
    </React.StrictMode>,
    document.getElementById('root')
);
