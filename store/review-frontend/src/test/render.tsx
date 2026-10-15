import { ThemeProvider } from '@mui/material';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import type { ReviewBundle } from '../contract/generated/review-bundle';
import { ReviewStoreProvider } from '../store/context';
import { createReviewStore, type ReviewStoreOptions } from '../store/reviewStore';
import { theme } from '../theme';

export function renderWithStore(ui: ReactElement, bundle: ReviewBundle, options?: ReviewStoreOptions) {
    const store = createReviewStore(bundle, options);
    const result = render(
        <ThemeProvider theme={theme}>
            <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <ReviewStoreProvider store={store}>{ui}</ReviewStoreProvider>
            </MemoryRouter>
        </ThemeProvider>
    );
    const textRoot = () => result.container.querySelector<HTMLElement>('[data-text-root]')!;
    return { ...result, store, textRoot };
}
