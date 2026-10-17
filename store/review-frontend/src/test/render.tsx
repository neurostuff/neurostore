import { ThemeProvider } from '@mui/material';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import type { ReviewBundle } from '../contract/generated/review-bundle';
import { ReviewStoresProvider } from '../store/context';
import { createReviewStores } from '../store/reviewStores';
import type { SessionStoreOptions } from '../store/sessionStore';
import { theme } from '../theme';

export function renderWithStores(ui: ReactElement, bundle: ReviewBundle, options?: SessionStoreOptions) {
    const stores = createReviewStores(bundle, options);
    const result = render(
        <ThemeProvider theme={theme}>
            <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <ReviewStoresProvider stores={stores}>{ui}</ReviewStoresProvider>
            </MemoryRouter>
        </ThemeProvider>
    );
    const textRoot = () => result.container.querySelector<HTMLElement>('[data-text-root]')!;
    return { ...result, stores, textRoot };
}
