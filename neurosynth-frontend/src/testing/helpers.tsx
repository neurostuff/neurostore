import { grey } from '@mui/material/colors';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import React from 'react';

export const MockThemeProvider: React.FC = (props) => {
    const mockTheme = createTheme({
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
                main: '#ffe66d',
                contrastText: '#000000',
            },
            success: {
                main: '#4caf50',
                contrastText: '#000000',
            },
            muted: {
                main: grey[500],
            },
        },
    });

    return <ThemeProvider theme={mockTheme}>{props.children}</ThemeProvider>;
};
