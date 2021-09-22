import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { createTheme, ThemeProvider, Theme } from '@mui/material/styles';
import { Auth0Provider } from '@auth0/auth0-react';
import { grey } from '@mui/material/colors';

declare module '@mui/styles/defaultTheme' {
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface DefaultTheme extends Theme {}
}

declare module '@mui/material/styles/createPalette' {
    interface Palette {
        muted: Palette['primary'];
    }
    interface PaletteOptions {
        muted: PaletteOptions['primary'];
    }
}

const theme = createTheme({
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

const domain = process.env.REACT_APP_AUTH0_DOMAIN as string;
const clientId = process.env.REACT_APP_AUTH0_CLIENT_ID as string;
const audience = process.env.REACT_APP_AUTH0_AUDIENCE as string;

ReactDOM.render(
    <React.StrictMode>
        <Auth0Provider
            domain={domain}
            clientId={clientId}
            redirectUri={window.location.origin}
            audience={audience}
        >
            <ThemeProvider theme={theme}>
                <App />
            </ThemeProvider>
        </Auth0Provider>
    </React.StrictMode>,
    document.getElementById('root')
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
