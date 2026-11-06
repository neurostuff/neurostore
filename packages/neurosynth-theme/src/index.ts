import type { ThemeOptions } from '@mui/material/styles';

declare module '@mui/material/styles' {
    interface Palette {
        muted: Palette['primary'];
    }
    interface PaletteOptions {
        muted?: PaletteOptions['primary'];
    }
}

export const themeOptions = {
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
            main: '#9e9e9e',
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
} satisfies ThemeOptions;
