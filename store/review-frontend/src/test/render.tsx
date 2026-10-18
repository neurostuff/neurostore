import { ThemeProvider } from '@mui/material';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import type { ReviewBundle } from '../contract/generated/review-bundle';
import { OpClientProvider, ReviewStoresProvider } from '../store/context';
import { createOpClient, type OpClient } from '../store/opClient';
import { createReviewStores, type ReviewStores } from '../store/reviewStores';
import type { SessionStoreOptions } from '../store/sessionStore';
import { theme } from '../theme';
import type { FakeServer } from './fakeServer';

function renderOver(ui: ReactElement, stores: ReviewStores, client?: OpClient) {
    const withClient = client ? <OpClientProvider client={client}>{ui}</OpClientProvider> : ui;
    const result = render(
        <ThemeProvider theme={theme}>
            <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <ReviewStoresProvider stores={stores}>{withClient}</ReviewStoresProvider>
            </MemoryRouter>
        </ThemeProvider>
    );
    const textRoot = () => result.container.querySelector<HTMLElement>('[data-text-root]')!;
    return { ...result, stores, textRoot };
}

export function renderWithStores(ui: ReactElement, bundle: ReviewBundle, options?: SessionStoreOptions) {
    return renderOver(ui, createReviewStores(bundle, options));
}

/** Renders `ui` on a review of the source `id` the fake server holds, saving through a started op client. */
export async function renderThroughServer(ui: ReactElement, server: FakeServer, id: string) {
    await server.backend.startReview(id);
    const stores = createReviewStores(await server.backend.getBundle(id));
    const client = createOpClient(stores.session, server.api());
    client.start();
    return { ...renderOver(ui, stores, client), client };
}
