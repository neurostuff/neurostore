import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Root } from './Root';

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <Root env={import.meta.env} />
    </StrictMode>
);
