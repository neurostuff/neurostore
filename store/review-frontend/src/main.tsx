import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { fixtureApi } from './api/fixtureApi';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <App api={fixtureApi(import.meta.env.BASE_URL)} />
    </StrictMode>
);
