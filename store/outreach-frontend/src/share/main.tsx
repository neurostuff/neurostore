import { CssBaseline, ThemeProvider } from '@mui/material';
import { createTheme } from '@mui/material/styles';
import { themeOptions } from '@neurosynth/theme';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { shareApi } from './api';
import { ShareRoot } from './ShareRoot';

const api = shareApi(String(import.meta.env.VITE_APP_NEUROSTORE_API_DOMAIN ?? ''));

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <ThemeProvider theme={createTheme(themeOptions)}>
            <CssBaseline />
            <ShareRoot api={api} />
        </ThemeProvider>
    </StrictMode>
);
