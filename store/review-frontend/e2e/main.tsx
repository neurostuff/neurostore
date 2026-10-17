import { CssBaseline, ThemeProvider } from '@mui/material';
import { createRoot } from 'react-dom/client';
import { httpApi } from '../src/api/httpApi';
import { App } from '../src/App';
import { theme } from '../src/theme';
import { E2E_API } from './api';

const paper = new URLSearchParams(window.location.search).get('paper') ?? 'P1';
window.history.replaceState(null, '', `/review/papers/${paper}`);

createRoot(document.getElementById('root')!).render(
    <ThemeProvider theme={theme}>
        <CssBaseline />
        <App api={httpApi(E2E_API, async () => 'e2e')} />
    </ThemeProvider>
);
