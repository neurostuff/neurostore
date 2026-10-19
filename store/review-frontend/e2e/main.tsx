import { CssBaseline, ThemeProvider } from '@mui/material';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { httpApi } from '../src/api/httpApi';
import { App } from '../src/App';
import { theme } from '../src/theme';
import { E2E_API } from './api';

const params = new URLSearchParams(window.location.search);
window.history.replaceState(
    null,
    '',
    params.get('page') === 'papers' ? '/review/' : `/review/papers/${params.get('paper') ?? 'P1'}`
);

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <App api={httpApi(E2E_API, async () => 'e2e')} />
        </ThemeProvider>
    </StrictMode>
);
